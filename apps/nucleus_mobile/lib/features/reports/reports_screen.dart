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
    } catch (e) {
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

        // Chat area
        Expanded(
          child: _messages.isEmpty ? _buildWelcome(isDesktop) : _buildChat(isDesktop),
        ),

        // Input bar
        _buildInputBar(isDesktop),
      ],
    );
  }

  Widget _buildWelcome(bool isDesktop) {
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: isDesktop ? 48 : 20,
          vertical: 24,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: NucleusColors.accentTeal.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.chat,
                  color: NucleusColors.accentTeal,
                  size: 32,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Ask me about expenses',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'I can show spending breakdowns, find claims, detect duplicates, and more.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 14),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: welcomeSuggestions
                    .map((s) => _SuggestionChip(
                          label: s,
                          onTap: () => _sendQuery(s),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: chartSuggestions
                    .map((s) => _SuggestionChip(
                          label: s,
                          filled: true,
                          onTap: () => _sendQuery(s),
                        ))
                    .toList(),
              ),
            ],
          ),
        ),
      ),
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
          responseType: msg.responseType!,
          data: msg.data!,
          meta: msg.meta!,
          text: msg.text,
          isDesktop: isDesktop,
        );
      },
    );
  }

  Widget _buildInputBar(bool isDesktop) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        isDesktop ? 32 : 12,
        8,
        isDesktop ? 32 : 12,
        isDesktop ? 16 : 8,
      ),
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
    );
  }
}

// ---------------------------------------------------------------------------
// Suggestion chip
// ---------------------------------------------------------------------------

class _SuggestionChip extends StatelessWidget {
  final String label;
  final bool filled;
  final VoidCallback onTap;

  const _SuggestionChip({
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled
          ? NucleusColors.accentTeal.withValues(alpha: 0.1)
          : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
              fontSize: 13,
              color: filled ? NucleusColors.accentTeal : NucleusColors.primaryNavy,
              fontWeight: filled ? FontWeight.w600 : FontWeight.w500,
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
      return _textBubble(text!);
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

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: isDesktop ? 700 : double.infinity,
        ),
        child: content,
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

// ---------------------------------------------------------------------------
// BAR CHART (spend by category, top spenders)
// ---------------------------------------------------------------------------

class _BarChartWidget extends StatelessWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final bool isDesktop;

  const _BarChartWidget({
    required this.data,
    required this.meta,
    required this.isDesktop,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return _emptyState('No data found for this query.');
    }

    // Determine if this is category or spender data
    final isCategory = data.first is Map && (data.first as Map).containsKey('category');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isCategory ? Icons.bar_chart : Icons.people,
                  color: NucleusColors.accentTeal,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  isCategory ? 'Spend by Category' : 'Top Spenders',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                if (meta['grandTotal'] != null)
                  Text(
                    'Total: ${_currencyFmt.format(meta['grandTotal'])}',
                    style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: data.length * 48.0 + 20,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: _maxValue * 1.15,
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final item = data[group.x] as Map;
                        final label = isCategory
                            ? (item['category'] ?? '').toString()
                            : (item['name'] ?? '').toString();
                        return BarTooltipItem(
                          '$label\n${_currencyFmt.format(rod.toY)}',
                          const TextStyle(color: Colors.white, fontSize: 12),
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
                          if (i < 0 || i >= data.length) return const SizedBox();
                          final item = data[i] as Map;
                          final label = isCategory
                              ? _capitalize(item['category'] ?? '')
                              : _truncate(item['name'] ?? '', 12);
                          return SideTitleWidget(
                            meta: titleMeta,
                            child: Text(
                              label,
                              style: const TextStyle(fontSize: 11),
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
                  barGroups: data.asMap().entries.map((e) {
                    final item = e.value as Map;
                    final total = (item['total'] as num?)?.toDouble() ?? 0;
                    final color = isCategory
                        ? (_categoryColors[item['category']] ?? NucleusColors.accentTeal)
                        : NucleusColors.accentTeal;
                    return BarChartGroupData(
                      x: e.key,
                      barRods: [
                        BarChartRodData(
                          toY: total,
                          color: color,
                          width: isDesktop ? 28 : 20,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
              ),
            ),
          ],
        ),
      ),
    );
  }

  double get _maxValue {
    double max = 0;
    for (final item in data) {
      final v = ((item as Map)['total'] as num?)?.toDouble() ?? 0;
      if (v > max) max = v;
    }
    return max == 0 ? 100 : max;
  }
}

// ---------------------------------------------------------------------------
// DONUT CHART (claims by status)
// ---------------------------------------------------------------------------

class _DonutChartWidget extends StatelessWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;

  const _DonutChartWidget({required this.data, required this.meta});

  static const _statusColors = {
    'pending': NucleusColors.pending,
    'approved': NucleusColors.approved,
    'rejected': NucleusColors.rejected,
    'queried': NucleusColors.queried,
    'submitted': Color(0xFF3b82f6),
    'posted': NucleusColors.posted,
  };

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return _emptyState('No status data found.');

    final total = (meta['total'] as num?)?.toInt() ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.donut_large, color: NucleusColors.accentTeal, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Claims by Status',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                Text(
                  '$total total',
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 200,
              child: Row(
                children: [
                  Expanded(
                    child: PieChart(
                      PieChartData(
                        sectionsSpace: 2,
                        centerSpaceRadius: 40,
                        sections: data.map((item) {
                          final map = item as Map;
                          final status = (map['status'] ?? '').toString();
                          final count = (map['count'] as num?)?.toDouble() ?? 0;
                          return PieChartSectionData(
                            value: count,
                            color: _statusColors[status] ?? Colors.grey,
                            title: '${count.toInt()}',
                            titleStyle: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            radius: 50,
                          );
                        }).toList(),
                      ),
                      duration: const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: data.map((item) {
                      final map = item as Map;
                      final status = (map['status'] ?? '').toString();
                      final count = (map['count'] as num?)?.toInt() ?? 0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _statusColors[status] ?? Colors.grey,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${_capitalize(status)} ($count)',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// LINE CHART (spend over time)
// ---------------------------------------------------------------------------

class _LineChartWidget extends StatelessWidget {
  final List<dynamic> data;
  final Map<String, dynamic> meta;
  final bool isDesktop;

  const _LineChartWidget({
    required this.data,
    required this.meta,
    required this.isDesktop,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return _emptyState('No trend data found.');

    final spots = data.asMap().entries.map((e) {
      final total = ((e.value as Map)['total'] as num?)?.toDouble() ?? 0;
      return FlSpot(e.key.toDouble(), total);
    }).toList();

    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.show_chart, color: NucleusColors.accentTeal, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Spend Over Time',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                if (meta['totalAmount'] != null)
                  Text(
                    'Total: ${_currencyFmt.format(meta['totalAmount'])}',
                    style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
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
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 28,
                        interval: 1,
                        getTitlesWidget: (value, titleMeta) {
                          final i = value.toInt();
                          if (i < 0 || i >= data.length) return const SizedBox();
                          final label = (data[i] as Map)['label'] ?? '';
                          return SideTitleWidget(
                            meta: titleMeta,
                            child: Text(
                              label.toString(),
                              style: const TextStyle(fontSize: 10, color: Colors.black45),
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
                              style: const TextStyle(fontSize: 10, color: Colors.black45),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (spots) => spots.map((s) {
                        return LineTooltipItem(
                          _currencyFmt.format(s.y),
                          const TextStyle(color: Colors.white, fontSize: 12),
                        );
                      }).toList(),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      curveSmoothness: 0.3,
                      color: NucleusColors.accentTeal,
                      barWidth: 3,
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, barData, index) =>
                            FlDotCirclePainter(
                          radius: 4,
                          color: NucleusColors.accentTeal,
                          strokeWidth: 2,
                          strokeColor: Colors.white,
                        ),
                      ),
                      belowBarData: BarAreaData(
                        show: true,
                        color: NucleusColors.accentTeal.withValues(alpha: 0.1),
                      ),
                    ),
                  ],
                ),
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SUMMARY CARD (average claim)
// ---------------------------------------------------------------------------

class _SummaryCardWidget extends StatelessWidget {
  final Map<String, dynamic> meta;

  const _SummaryCardWidget({required this.meta});

  @override
  Widget build(BuildContext context) {
    final value = (meta['value'] as num?)?.toDouble() ?? 0;
    final totalClaims = (meta['claims'] as num?)?.toInt() ?? 0;
    final totalAmount = (meta['total'] as num?)?.toDouble() ?? 0;
    final label = (meta['valueLabel'] ?? 'Average Claim Value').toString();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.analytics, color: NucleusColors.accentTeal, size: 20),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Center(
              child: Text(
                _currencyFmt.format(value),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.accentTeal,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _SummaryMetric(label: 'Total Claims', value: '$totalClaims'),
                const SizedBox(width: 32),
                _SummaryMetric(
                  label: 'Total Spend',
                  value: _currencyFmt.format(totalAmount),
                ),
              ],
            ),
          ],
        ),
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
          style: NucleusTheme.monoAmount(fontSize: 14, color: NucleusColors.primaryNavy),
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
// CLAIMS TABLE
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.table_chart, color: NucleusColors.accentTeal, size: 20),
                const SizedBox(width: 8),
                Text(
                  '$total claims',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                if (totalAmount != null)
                  Text(
                    'Total: ${_currencyFmt.format(totalAmount)}',
                    style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (isDesktop) _buildDesktopTable() else _buildMobileList(),
          ],
        ),
      ),
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
                Icon(categoryIcon((map['category'] ?? '').toString()), size: 14, color: NucleusColors.accentTeal),
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
              Icon(categoryIcon((map['category'] ?? '').toString()), size: 20, color: NucleusColors.accentTeal),
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
// TIMELINE (policy changes, duplicates)
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isDuplicate ? Icons.warning : Icons.history,
                  color: isDuplicate ? NucleusColors.warning : NucleusColors.accentTeal,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  isDuplicate ? 'Potential Duplicates' : 'Policy Changes',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                Text(
                  '${meta['total'] ?? data.length} found',
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
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
                  color: NucleusColors.accentTeal,
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
  return Card(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.search_off, size: 32, color: Colors.black26),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(color: Colors.black54)),
          ],
        ),
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
