import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import 'reports_engine.dart';
import '../claims/new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Category display helpers
// ---------------------------------------------------------------------------

const _categoryColors = {
  'meals': Color(0xFFf97316),
  'travel': Color(0xFF3b82f6),
  'accommodation': Color(0xFF8b5cf6),
  'transport': Color(0xFFeab308),
  'office_supplies': Color(0xFF6b7280),
  'training': Color(0xFF22c55e),
  'mileage': Color(0xFF2E8B8B),
  'other': Color(0xFF9ca3af),
};

final _currencyFmt = NumberFormat.currency(locale: 'en_GB', symbol: '£');

// Nucleus palette constants used across charts
const _kNavy = Color(0xFF1B2A4A);
const _kTeal = Color(0xFF2E8B8B);
const _kTealDark = Color(0xFF1E6B6B);
const _kTealLight = Color(0xFF5AABAB);
const _kTealTint = Color(0xFFEAF5F5);

// ---------------------------------------------------------------------------
// Chat message model
// ---------------------------------------------------------------------------

class _ChatMessage {
  final bool isUser;
  final String? text;
  final String? responseType;
  final List<dynamic>? data;
  final Map<String, dynamic>? meta;
  final bool isLoading;

  const _ChatMessage({
    required this.isUser,
    this.text,
    this.responseType,
    this.data,
    this.meta,
    this.isLoading = false,
  });
}

// ---------------------------------------------------------------------------
// Reports Screen
// ---------------------------------------------------------------------------

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();
  final List<_ChatMessage> _messages = [];
  bool _isLoading = false;

  static const _welcomeText =
      "Hi! Ask me about expenses — spend by category, claims by status, "
      'policy changes, trends, and more. Try a suggestion below, or type '
      'your own question.';

  @override
  void initState() {
    super.initState();
    // Seed a welcome system message so the chat is never visually empty
    // and the user always has context for what to ask.
    _messages.add(const _ChatMessage(isUser: false, text: _welcomeText));
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendQuery(String query) async {
    if (query.trim().isEmpty) return;

    setState(() {
      _messages.add(_ChatMessage(isUser: true, text: query));
      _messages.add(const _ChatMessage(isUser: false, isLoading: true));
      _isLoading = true;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      final detection = detectIntent(query);
      final apiClient = context.read<AuthProvider>().apiClient;
      final response = await apiClient.post('/reports/query', body: {
        'intent': intentToApiString(detection.intent),
        'params': detection.params.toJson(),
      });

      final responseType = response['responseType'] as String? ?? 'unknown';
      final data = response['data'] as List<dynamic>? ?? [];
      final meta = response['meta'] as Map<String, dynamic>? ?? {};

      setState(() {
        // Remove loading message
        _messages.removeWhere((m) => m.isLoading);
        _messages.add(_ChatMessage(
          isUser: false,
          responseType: responseType,
          data: data,
          meta: meta,
        ));
        _isLoading = false;
      });
    } catch (e, st) {
      debugPrint('Reports query error: $e\n$st');
      setState(() {
        _messages.removeWhere((m) => m.isLoading);
        _messages.add(_ChatMessage(
          isUser: false,
          text: 'Sorry, I couldn\'t process that query. Please try again.',
        ));
        _isLoading = false;
      });
    }
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Column(
      children: [
        // Header for desktop
        if (isDesktop)
          Container(
            padding: const EdgeInsets.fromLTRB(32, 24, 32, 16),
            alignment: Alignment.centerLeft,
            child: const Text(
              'Reports',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: NucleusColors.primaryNavy,
              ),
            ),
          ),

        // Chat area — always shown. The welcome message is the first item
        // when no queries have been run yet.
        Expanded(child: _buildChat(isDesktop)),

        // Bottom bar — input field + persistent suggestion chips below.
        _buildBottomBar(isDesktop),
      ],
    );
  }

  Widget _buildChat(bool isDesktop) {
    return ListView.builder(
      controller: _scrollController,
      padding: EdgeInsets.symmetric(
        horizontal: isDesktop ? 32 : 16,
        vertical: 16,
      ),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final msg = _messages[index];
        if (msg.isUser) return _UserBubble(text: msg.text!);
        if (msg.isLoading) return const _LoadingBubble();
        return _ResponseCard(
          responseType: msg.responseType ?? 'unknown',
          data: msg.data ?? [],
          meta: msg.meta ?? {},
          text: msg.text,
          isDesktop: isDesktop,
        );
      },
    );
  }

  Widget _buildBottomBar(bool isDesktop) {
    final hPad = isDesktop ? 32.0 : 12.0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Input row
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 10, hPad, 8),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          focusNode: _focusNode,
                          enabled: !_isLoading,
                          textInputAction: TextInputAction.send,
                          onSubmitted: _sendQuery,
                          decoration: InputDecoration(
                            hintText: 'Ask about expenses...',
                            hintStyle: const TextStyle(color: Colors.black38),
                            filled: true,
                            fillColor: NucleusColors.background,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 12,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        onPressed: _isLoading
                            ? null
                            : () => _sendQuery(_controller.text),
                        style: IconButton.styleFrom(
                          backgroundColor: NucleusColors.accentTeal,
                          disabledBackgroundColor: Colors.grey.shade300,
                        ),
                        icon: const Icon(Icons.send, color: Colors.white, size: 20),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Persistent suggestion chips — always visible, never disappear.
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 0, hPad, isDesktop ? 16 : 10),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: persistentSuggestions
                        .map((s) => _SuggestionChip(
                              label: s,
                              filled: true,
                              onTap: _isLoading ? null : () => _sendQuery(s),
                            ))
                        .toList(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Suggestion chip
// ---------------------------------------------------------------------------

class _SuggestionChip extends StatelessWidget {
  final String label;
  final bool filled;
  final VoidCallback? onTap;

  const _SuggestionChip({
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return Opacity(
      opacity: disabled ? 0.5 : 1.0,
      child: Material(
        color: filled
            ? NucleusColors.accentTeal.withValues(alpha: 0.1)
            : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: filled
                    ? NucleusColors.accentTeal.withValues(alpha: 0.3)
                    : Colors.black12,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                color: filled ? NucleusColors.accentTeal : NucleusColors.primaryNavy,
                fontWeight: filled ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// User bubble
// ---------------------------------------------------------------------------

class _UserBubble extends StatelessWidget {
  final String text;
  const _UserBubble({required this.text});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, left: 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: NucleusColors.primaryNavy,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, fontSize: 14),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loading bubble
// ---------------------------------------------------------------------------

class _LoadingBubble extends StatelessWidget {
  const _LoadingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, right: 48),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: NucleusColors.accentTeal,
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'Analysing...',
              style: TextStyle(color: Colors.black54, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED SLIDE-IN WRAPPER
// Slide up 12px + fade in, 300ms, Curves.easeOut
// ═══════════════════════════════════════════════════════════════════════════

class _AnimatedSlideIn extends StatefulWidget {
  final Widget child;
  const _AnimatedSlideIn({required this.child});

  @override
  State<_AnimatedSlideIn> createState() => _AnimatedSlideInState();
}

class _AnimatedSlideInState extends State<_AnimatedSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _offset = Tween<Offset>(
      begin: const Offset(0, 12),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => Transform.translate(
        offset: _offset.value,
        child: Opacity(opacity: _opacity.value, child: child),
      ),
      child: widget.child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART CONTAINER
// White bg, rounded 12px, subtle shadow, 4px teal accent bar at top,
// chart title with icon, 20px padding.
// ═══════════════════════════════════════════════════════════════════════════

class _ChartContainer extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget? trailing;
  final Widget child;

  const _ChartContainer({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 4px teal accent bar
          Container(height: 4, color: _kTeal),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title row
                Row(
                  children: [
                    Icon(icon, color: _kTeal, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: _kNavy,
                      ),
                    ),
                    if (trailing != null) ...[
                      const Spacer(),
                      trailing!,
                    ],
                  ],
                ),
                const SizedBox(height: 20),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Response card — routes to the correct visualization
// ---------------------------------------------------------------------------

class _ResponseCard extends StatelessWidget {
  final String responseType;
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final String? text;
  final bool isDesktop;

  const _ResponseCard({
    required this.responseType,
    required this.data,
    required this.meta,
    required this.isDesktop,
    this.text,
  });

  @override
  Widget build(BuildContext context) {
    if (text != null) {
      return _AnimatedSlideIn(child: _textBubble(text!));
    }

    Widget content;
    switch (responseType) {
      case 'bar_chart':
        content = _BarChartWidget(data: data, meta: meta, isDesktop: isDesktop);
      case 'donut_chart':
        content = _DonutChartWidget(data: data, meta: meta);
      case 'line_chart':
        content = _LineChartWidget(data: data, meta: meta, isDesktop: isDesktop);
      case 'summary_card':
        content = _SummaryCardWidget(meta: meta);
      case 'table':
        content = _ClaimsTableWidget(data: data, meta: meta, isDesktop: isDesktop);
      case 'timeline':
        content = _TimelineWidget(data: data, meta: meta);
      default:
        content = _textBubble(
          'I couldn\'t find a way to display that. Try rephrasing your question.',
        );
    }

    return _AnimatedSlideIn(
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          constraints: BoxConstraints(
            maxWidth: isDesktop ? 700 : double.infinity,
          ),
          child: content,
        ),
      ),
    );
  }

  Widget _textBubble(String msg) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, right: 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(msg, style: const TextStyle(fontSize: 14)),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAR CHART — teal gradient bars, rounded top corners, navy tooltip
// ═══════════════════════════════════════════════════════════════════════════

class _BarChartWidget extends StatefulWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final bool isDesktop;

  const _BarChartWidget({
    required this.data,
    required this.meta,
    required this.isDesktop,
  });

  @override
  State<_BarChartWidget> createState() => _BarChartWidgetState();
}

class _BarChartWidgetState extends State<_BarChartWidget> {
  bool _animated = false;

  @override
  void initState() {
    super.initState();
    // Trigger animation from zero → real values after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _animated = true);
    });
  }

  double get _maxValue {
    double max = 0;
    for (final item in widget.data) {
      final v = ((item as Map)['total'] as num?)?.toDouble() ?? 0;
      if (v > max) max = v;
    }
    return max == 0 ? 100 : max;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.data.isEmpty) return _emptyState('No data found for this query.');

    final isCategory =
        widget.data.first is Map && (widget.data.first as Map).containsKey('category');

    return _ChartContainer(
      title: isCategory ? 'Spend by Category' : 'Top Spenders',
      icon: isCategory ? Icons.bar_chart : Icons.people,
      trailing: widget.meta['grandTotal'] != null
          ? Text(
              'Total: ${_currencyFmt.format(widget.meta['grandTotal'])}',
              style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
            )
          : null,
      child: SizedBox(
        height: widget.data.length * 48.0 + 20,
        child: BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceAround,
            maxY: _maxValue * 1.15,
            barTouchData: BarTouchData(
              touchTooltipData: BarTouchTooltipData(
                tooltipRoundedRadius: 8,
                tooltipPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                getTooltipColor: (_) => _kNavy,
                getTooltipItem: (group, groupIndex, rod, rodIndex) {
                  final item = widget.data[group.x] as Map;
                  final label = isCategory
                      ? _capitalize(item['category'] ?? '')
                      : (item['name'] ?? '').toString();
                  return BarTooltipItem(
                    '$label\n${_currencyFmt.format(rod.toY)}',
                    const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  );
                },
              ),
            ),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 32,
                  getTitlesWidget: (value, titleMeta) {
                    final i = value.toInt();
                    if (i < 0 || i >= widget.data.length) return const SizedBox();
                    final item = widget.data[i] as Map;
                    final label = isCategory
                        ? _capitalize(item['category'] ?? '')
                        : _truncate(item['name'] ?? '', 12);
                    return SideTitleWidget(
                      meta: titleMeta,
                      child: Text(
                        label,
                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 60,
                  getTitlesWidget: (value, titleMeta) {
                    return SideTitleWidget(
                      meta: titleMeta,
                      child: Text(
                        _shortCurrency(value),
                        style: const TextStyle(fontSize: 10, color: Colors.black45),
                      ),
                    );
                  },
                ),
              ),
            ),
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              getDrawingHorizontalLine: (value) => FlLine(
                color: Colors.black.withValues(alpha: 0.05),
                strokeWidth: 1,
              ),
            ),
            borderData: FlBorderData(show: false),
            barGroups: widget.data.asMap().entries.map((e) {
              final item = e.value as Map;
              final total = _animated
                  ? ((item['total'] as num?)?.toDouble() ?? 0)
                  : 0.0;
              return BarChartGroupData(
                x: e.key,
                barRods: [
                  BarChartRodData(
                    toY: total,
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [_kTealDark, _kTealLight],
                    ),
                    width: widget.isDesktop ? 32 : 24,
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(6)),
                  ),
                ],
              );
            }).toList(),
          ),
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeOutCubic,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DONUT CHART — status colours, center total, sweep animation, legend
// ═══════════════════════════════════════════════════════════════════════════

class _DonutChartWidget extends StatefulWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;

  const _DonutChartWidget({required this.data, required this.meta});

  @override
  State<_DonutChartWidget> createState() => _DonutChartWidgetState();
}

class _DonutChartWidgetState extends State<_DonutChartWidget> {
  bool _animated = false;

  static const _statusColors = {
    'approved': Color(0xFF059669),
    'pending': Color(0xFFD97706),
    'rejected': Color(0xFFDC2626),
    'queried': Color(0xFF7C3AED),
    'submitted': Color(0xFF3b82f6),
    'posted': Color(0xFF2563EB),
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _animated = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.data.isEmpty) return _emptyState('No status data found.');

    final total = (widget.meta['total'] as num?)?.toInt() ?? 0;

    // Calculate percentages
    final totalCount = widget.data.fold<double>(
      0,
      (sum, item) => sum + (((item as Map)['count'] as num?)?.toDouble() ?? 0).abs(),
    );

    return _ChartContainer(
      title: 'Claims by Status',
      icon: Icons.donut_large,
      trailing: Text(
        '$total total',
        style: const TextStyle(color: Colors.black54, fontSize: 13),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 200,
            child: Stack(
              alignment: Alignment.center,
              children: [
                PieChart(
                  PieChartData(
                    sectionsSpace: 3,
                    centerSpaceRadius: 50,
                    sections: widget.data.map((item) {
                      final map = item as Map;
                      final status = (map['status'] ?? '').toString();
                      final count =
                          _animated ? ((map['count'] as num?)?.toDouble() ?? 0) : 0.0;
                      final color = _statusColors[status] ?? Colors.grey;
                      return PieChartSectionData(
                        value: count == 0 ? 0.01 : count, // avoid zero
                        color: color,
                        title: count > 0 ? '${count.toInt()}' : '',
                        titleStyle: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                        radius: 56,
                        titlePositionPercentageOffset: 0.55,
                      );
                    }).toList(),
                  ),
                  duration: const Duration(milliseconds: 800),
                  curve: Curves.easeOutCubic,
                ),
                // Center label
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$total',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: _kNavy,
                      ),
                    ),
                    const Text(
                      'claims',
                      style: TextStyle(fontSize: 11, color: Colors.black45),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Legend with coloured dots and percentages
          Wrap(
            spacing: 20,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: widget.data.map((item) {
              final map = item as Map;
              final status = (map['status'] ?? '').toString();
              final count = (map['count'] as num?)?.toDouble() ?? 0;
              final pct =
                  totalCount > 0 ? (count / totalCount * 100).toStringAsFixed(1) : '0';
              final color = _statusColors[status] ?? Colors.grey;
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${_capitalize(status)} $pct%',
                    style: const TextStyle(fontSize: 12, color: Colors.black87),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LINE CHART — teal line, gradient fill, left-to-right draw animation
// ═══════════════════════════════════════════════════════════════════════════

class _LineChartWidget extends StatefulWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final bool isDesktop;

  const _LineChartWidget({
    required this.data,
    required this.meta,
    required this.isDesktop,
  });

  @override
  State<_LineChartWidget> createState() => _LineChartWidgetState();
}

class _LineChartWidgetState extends State<_LineChartWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.data.isEmpty) return _emptyState('No trend data found.');

    final realSpots = widget.data.asMap().entries.map((e) {
      final total = ((e.value as Map)['total'] as num?)?.toDouble() ?? 0;
      return FlSpot(e.key.toDouble(), total);
    }).toList();

    final maxY = realSpots.map((s) => s.y).reduce((a, b) => a > b ? a : b);

    return _ChartContainer(
      title: 'Spend Over Time',
      icon: Icons.show_chart,
      trailing: widget.meta['totalAmount'] != null
          ? Text(
              'Total: ${_currencyFmt.format(widget.meta['totalAmount'])}',
              style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
            )
          : null,
      child: AnimatedBuilder(
        animation: _anim,
        builder: (_, __) {
          // Left-to-right reveal: animate each spot's Y based on its position
          final progress = _anim.value;
          final n = realSpots.length;
          final spots = realSpots.map((s) {
            // Each point fades in based on wave position
            final pointProgress =
                ((progress * (n + 1)) - s.x).clamp(0.0, 1.0);
            return FlSpot(s.x, s.y * pointProgress);
          }).toList();

          return SizedBox(
            height: 220,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: maxY * 1.15,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: Colors.black.withValues(alpha: 0.05),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles:
                      const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles:
                      const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: 1,
                      getTitlesWidget: (value, titleMeta) {
                        final i = value.toInt();
                        if (i < 0 || i >= widget.data.length) {
                          return const SizedBox();
                        }
                        final label =
                            (widget.data[i] as Map)['label'] ?? '';
                        return SideTitleWidget(
                          meta: titleMeta,
                          child: Text(
                            label.toString(),
                            style: const TextStyle(
                                fontSize: 10, color: Colors.black45),
                          ),
                        );
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 56,
                      getTitlesWidget: (value, titleMeta) {
                        return SideTitleWidget(
                          meta: titleMeta,
                          child: Text(
                            _shortCurrency(value),
                            style: const TextStyle(
                                fontSize: 10, color: Colors.black45),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    tooltipRoundedRadius: 8,
                    getTooltipColor: (_) => _kNavy,
                    getTooltipItems: (touchedSpots) => touchedSpots.map((s) {
                      // Show the real value, not the animated one
                      final realY = realSpots[s.spotIndex].y;
                      return LineTooltipItem(
                        _currencyFmt.format(realY),
                        const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      );
                    }).toList(),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    curveSmoothness: 0.3,
                    color: _kTeal,
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: progress > 0.3, // show dots after initial draw
                      getDotPainter: (spot, percent, barData, index) {
                        // Fade dots in as the wave reaches them
                        final dotProgress =
                            ((progress * (n + 1)) - spot.x).clamp(0.0, 1.0);
                        return FlDotCirclePainter(
                          radius: 5,
                          color: _kTeal.withValues(alpha: dotProgress),
                          strokeWidth: 2.5,
                          strokeColor:
                              Colors.white.withValues(alpha: dotProgress),
                        );
                      },
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          _kTeal.withValues(alpha: 0.25 * progress),
                          _kTeal.withValues(alpha: 0.02 * progress),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              duration: Duration.zero, // we handle animation ourselves
            ),
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY CARD — navy number, teal accent, count-up animation
// ═══════════════════════════════════════════════════════════════════════════

class _SummaryCardWidget extends StatefulWidget {
  final Map<String, dynamic> meta;
  const _SummaryCardWidget({required this.meta});

  @override
  State<_SummaryCardWidget> createState() => _SummaryCardWidgetState();
}

class _SummaryCardWidgetState extends State<_SummaryCardWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final value = (widget.meta['value'] as num?)?.toDouble() ?? 0;
    final totalClaims = (widget.meta['claims'] as num?)?.toInt() ?? 0;
    final totalAmount = (widget.meta['total'] as num?)?.toDouble() ?? 0;
    final label = (widget.meta['valueLabel'] ?? 'Average Claim Value').toString();

    return _ChartContainer(
      title: label,
      icon: Icons.analytics,
      child: AnimatedBuilder(
        animation: _anim,
        builder: (_, __) {
          final displayValue = value * _anim.value;
          final displayClaims = (totalClaims * _anim.value).round();
          final displayTotal = totalAmount * _anim.value;

          return Column(
            children: [
              // Main value with teal left border and tint background
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: _kTealTint,
                  borderRadius: BorderRadius.circular(8),
                  border: Border(
                    left: BorderSide(color: _kTeal, width: 4),
                  ),
                ),
                child: Center(
                  child: Text(
                    _currencyFmt.format(displayValue),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: _kNavy,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Sub-metrics
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SummaryMetric(
                    label: 'Total Claims',
                    value: '$displayClaims',
                  ),
                  const SizedBox(width: 32),
                  _SummaryMetric(
                    label: 'Total Spend',
                    value: _currencyFmt.format(displayTotal),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryMetric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: NucleusTheme.monoAmount(fontSize: 14, color: _kNavy),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// CLAIMS TABLE (unchanged structure, wrapped in ChartContainer)
// ---------------------------------------------------------------------------

class _ClaimsTableWidget extends StatelessWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final bool isDesktop;

  const _ClaimsTableWidget({
    required this.data,
    required this.meta,
    required this.isDesktop,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return _emptyState('No claims found matching your query.');

    final total = (meta['total'] as num?)?.toInt() ?? data.length;
    final totalAmount = meta['totalAmount'] as num?;

    return _ChartContainer(
      title: '$total claims',
      icon: Icons.table_chart,
      trailing: totalAmount != null
          ? Text(
              'Total: ${_currencyFmt.format(totalAmount)}',
              style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
            )
          : null,
      child: isDesktop ? _buildDesktopTable() : _buildMobileList(),
    );
  }

  Widget _buildDesktopTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columnSpacing: 20,
        headingRowHeight: 40,
        dataRowMinHeight: 40,
        dataRowMaxHeight: 48,
        columns: const [
          DataColumn(label: Text('Date', style: TextStyle(fontWeight: FontWeight.w600))),
          DataColumn(label: Text('Description', style: TextStyle(fontWeight: FontWeight.w600))),
          DataColumn(label: Text('Category', style: TextStyle(fontWeight: FontWeight.w600))),
          DataColumn(label: Text('Amount', style: TextStyle(fontWeight: FontWeight.w600)), numeric: true),
          DataColumn(label: Text('Claimant', style: TextStyle(fontWeight: FontWeight.w600))),
          DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.w600))),
        ],
        rows: data.take(20).map((item) {
          final map = item as Map;
          return DataRow(cells: [
            DataCell(Text(_formatDate(map['date']), style: const TextStyle(fontSize: 13))),
            DataCell(
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 200),
                child: Text(
                  (map['description'] ?? '').toString(),
                  style: const TextStyle(fontSize: 13),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            DataCell(Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(categoryIcon((map['category'] ?? '').toString()), size: 14, color: _kTeal),
                const SizedBox(width: 6),
                Text(_capitalize(map['category'] ?? ''), style: const TextStyle(fontSize: 13)),
              ],
            )),
            DataCell(Text(
              _currencyFmt.format((map['amount'] as num?)?.toDouble() ?? 0),
              style: NucleusTheme.monoAmount(fontSize: 13),
            )),
            DataCell(Text((map['claimant'] ?? '').toString(), style: const TextStyle(fontSize: 13))),
            DataCell(_StatusBadge(status: (map['status'] ?? '').toString())),
          ]);
        }).toList(),
      ),
    );
  }

  Widget _buildMobileList() {
    return Column(
      children: data.take(20).map((item) {
        final map = item as Map;
        final amount = (map['amount'] as num?)?.toDouble() ?? 0;
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Colors.black12)),
          ),
          child: Row(
            children: [
              Icon(categoryIcon((map['category'] ?? '').toString()), size: 20, color: _kTeal),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (map['description'] ?? '').toString(),
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${map['claimant'] ?? ''} · ${_formatDate(map['date'])}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _currencyFmt.format(amount),
                    style: NucleusTheme.monoAmount(fontSize: 14),
                  ),
                  const SizedBox(height: 2),
                  _StatusBadge(status: (map['status'] ?? '').toString()),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// ---------------------------------------------------------------------------
// TIMELINE (policy changes, duplicates — wrapped in ChartContainer)
// ---------------------------------------------------------------------------

class _TimelineWidget extends StatelessWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;

  const _TimelineWidget({required this.data, required this.meta});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return _emptyState('No timeline events found.');

    final isDuplicate = data.isNotEmpty &&
        (data.first as Map).containsKey('message');

    return _ChartContainer(
      title: isDuplicate ? 'Potential Duplicates' : 'Policy Changes',
      icon: isDuplicate ? Icons.warning : Icons.history,
      trailing: Text(
        '${meta['total'] ?? data.length} found',
        style: const TextStyle(color: Colors.black54, fontSize: 13),
      ),
      child: Column(
        children: [
          ...data.take(10).map((item) {
            final map = item as Map;
            if (isDuplicate) {
              return _DuplicateItem(
                message: (map['message'] ?? '').toString(),
                date: _formatDate(map['created_at']),
              );
            }
            return _PolicyChangeItem(
              date: _formatDate(map['created_at']),
              evaluatedBy: (map['evaluated_by'] ?? '').toString(),
              changes: map['changes'] as Map<String, dynamic>? ?? {},
            );
          }),
        ],
      ),
    );
  }
}

class _PolicyChangeItem extends StatelessWidget {
  final String date;
  final String evaluatedBy;
  final Map<String, dynamic> changes;

  const _PolicyChangeItem({
    required this.date,
    required this.evaluatedBy,
    required this.changes,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: _kTeal,
                  shape: BoxShape.circle,
                ),
              ),
              Container(width: 2, height: 40, color: Colors.black12),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(date, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 2),
                Text(
                  'Updated by $evaluatedBy',
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                ),
                if (changes.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  ...changes.entries.take(3).map((e) => Text(
                        '${_capitalize(e.key)}: ${e.value}',
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      )),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DuplicateItem extends StatelessWidget {
  final String message;
  final String date;

  const _DuplicateItem({required this.message, required this.date});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NucleusColors.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: NucleusColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning, color: NucleusColors.warning, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(message, style: const TextStyle(fontSize: 13)),
                const SizedBox(height: 2),
                Text(date, style: const TextStyle(fontSize: 11, color: Colors.black54)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  static const _colors = {
    'pending': NucleusColors.pending,
    'approved': NucleusColors.approved,
    'rejected': NucleusColors.rejected,
    'queried': NucleusColors.queried,
    'submitted': Color(0xFF3b82f6),
    'posted': NucleusColors.posted,
  };

  @override
  Widget build(BuildContext context) {
    final color = _colors[status] ?? Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        _capitalize(status),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

Widget _emptyState(String message) {
  return _ChartContainer(
    title: 'No Results',
    icon: Icons.search_off,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(message, style: const TextStyle(color: Colors.black54)),
      ),
    ),
  );
}

String _capitalize(String s) {
  if (s.isEmpty) return s;
  return s[0].toUpperCase() + s.substring(1).replaceAll('_', ' ');
}

String _truncate(String s, int max) =>
    s.length <= max ? s : '${s.substring(0, max)}...';

String _formatDate(dynamic d) {
  if (d == null) return '';
  try {
    final dt = DateTime.parse(d.toString());
    return DateFormat('dd MMM yyyy').format(dt);
  } catch (_) {
    return d.toString();
  }
}

String _shortCurrency(double value) {
  if (value >= 1000) return '£${(value / 1000).toStringAsFixed(1)}k';
  return '£${value.toStringAsFixed(0)}';
}
