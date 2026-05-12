import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../shared/widgets/nucleus_avatar.dart';
import '../../shared/widgets/status_badge.dart';
import '../claims/new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Person Detail Panel
// Desktop: slides in from right (380px wide)
// Mobile: shown as bottom sheet
// ---------------------------------------------------------------------------

class PersonDetailPanel extends StatefulWidget {
  final String personId;
  final String level; // 'self', 'report', 'basic'
  final String viewerId;
  final VoidCallback onClose;

  const PersonDetailPanel({
    super.key,
    required this.personId,
    required this.level,
    required this.viewerId,
    required this.onClose,
  });

  /// Show as a modal bottom sheet on mobile.
  static Future<void> showAsBottomSheet(
    BuildContext context, {
    required String personId,
    required String level,
    required String viewerId,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return PersonDetailPanel(
            personId: personId,
            level: level,
            viewerId: viewerId,
            onClose: () => Navigator.of(context).pop(),
          );
        },
      ),
    );
  }

  @override
  State<PersonDetailPanel> createState() => _PersonDetailPanelState();
}

class _PersonDetailPanelState extends State<PersonDetailPanel> {
  Map<String, dynamic>? _person;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadPerson();
  }

  Future<void> _loadPerson() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final resp = await api.get(
          '/people/${Uri.encodeComponent(widget.personId)}');
      if (mounted) {
        setState(() {
          _person = resp['data'];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _name => _person != null
      ? '${_person!['first_name']} ${_person!['last_name']}'
      : '\u2026';

  String get _initials {
    if (_person == null) return '';
    final f = _person!['first_name'] ?? '';
    final l = _person!['last_name'] ?? '';
    return '${f.isNotEmpty ? f[0] : ''}${l.isNotEmpty ? l[0] : ''}';
  }

  String get _dept {
    if (_person == null) return '';
    final orgInfo = _person!['org_info'];
    if (orgInfo is Map && orgInfo['name'] != null) return orgInfo['name'];
    final orgUnit = _person!['org_unit'] ?? '';
    return orgUnit
        .toString()
        .replaceAll(RegExp(r'^org_unit:'), '')
        .replaceAll('_', ' ');
  }

  bool get _isSelf => widget.personId == widget.viewerId;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          _buildHeader(),

          // Body
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      _buildProfileSection(),
                      if (widget.level == 'self' ||
                          widget.level == 'report') ...[
                        const SizedBox(height: 16),
                        _buildActivitySection(),
                      ],
                      if (widget.level == 'basic' && !_loading) ...[
                        const SizedBox(height: 16),
                        Center(
                          child: Text(
                            'Detailed activity is only visible\nfor your direct reports and below',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[400],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 12, 16),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.grey[100]!),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          if (_loading)
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                shape: BoxShape.circle,
              ),
            )
          else
            NucleusAvatar(
              initials: _initials,
              size: 48,
              fontSize: 16,
            ),

          const SizedBox(width: 12),

          // Name + title
          Expanded(
            child: _loading
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 16,
                        width: 120,
                        decoration: BoxDecoration(
                          color: Colors.grey[200],
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 12,
                        width: 80,
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              _name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: NucleusColors.primaryNavy,
                              ),
                            ),
                          ),
                          if (_isSelf) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: NucleusColors.accentTeal
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Text(
                                'You',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: NucleusColors.accentTeal,
                                ),
                              ),
                            ),
                          ],
                          if (widget.level == 'report' && !_isSelf) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: NucleusColors.warning
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Text(
                                'Reports to you',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: NucleusColors.warning,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _person?['job_title'] ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[500],
                        ),
                      ),
                      Text(
                        _dept,
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[400],
                        ),
                      ),
                    ],
                  ),
          ),

          // Close button
          IconButton(
            onPressed: widget.onClose,
            icon: const Icon(Icons.close, size: 20),
            color: Colors.grey[400],
            constraints: const BoxConstraints(
              minWidth: 32,
              minHeight: 32,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileSection() {
    if (_person == null) return const SizedBox.shrink();

    final ccInfo = _person!['cc_info'];
    final rows = <({IconData icon, String label, String value})>[
      if (_person!['email'] != null)
        (
          icon: Icons.email_outlined,
          label: 'Email',
          value: _person!['email'],
        ),
      if (_person!['employee_id'] != null)
        (
          icon: Icons.badge_outlined,
          label: 'Employee ID',
          value: _person!['employee_id'],
        ),
      if (_person!['employment_type'] != null)
        (
          icon: Icons.description_outlined,
          label: 'Employment',
          value: _person!['employment_type']
              .toString()
              .replaceAll('_', ' '),
        ),
      if (_dept.isNotEmpty)
        (
          icon: Icons.business_outlined,
          label: 'Department',
          value: _dept,
        ),
      if (ccInfo is Map && (ccInfo['name'] ?? ccInfo['code']) != null)
        (
          icon: Icons.credit_card_outlined,
          label: 'Cost Centre',
          value: ccInfo['name'] ?? ccInfo['code'],
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PROFILE',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Colors.grey[400],
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),
        ...rows.map((row) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(row.icon, size: 18, color: Colors.grey[500]),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.label.toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey[400],
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          row.value,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: NucleusColors.primaryNavy,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _buildActivitySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Divider(color: Colors.grey[100]),
        const SizedBox(height: 8),
        Text(
          _isSelf ? 'MY ACTIVITY' : 'ACTIVITY & RECORDS',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Colors.grey[400],
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),

        // Expenses — live
        _CollapsibleSection(
          title: 'Expenses',
          icon: Icons.payments_outlined,
          isLive: true,
          initiallyOpen: true,
          child: _ExpensesSection(personId: widget.personId),
        ),

        const SizedBox(height: 8),

        // Placeholder sections
        _CollapsibleSection(
          title: 'Timesheets',
          icon: Icons.timer_outlined,
        ),
        const SizedBox(height: 8),
        _CollapsibleSection(
          title: 'Leave & Holidays',
          icon: Icons.beach_access_outlined,
        ),
        const SizedBox(height: 8),
        _CollapsibleSection(
          title: 'Performance & Development',
          icon: Icons.trending_up_outlined,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

class _CollapsibleSection extends StatefulWidget {
  final String title;
  final IconData icon;
  final bool isLive;
  final bool initiallyOpen;
  final Widget? child;

  const _CollapsibleSection({
    required this.title,
    required this.icon,
    this.isLive = false,
    this.initiallyOpen = false,
    this.child,
  });

  @override
  State<_CollapsibleSection> createState() => _CollapsibleSectionState();
}

class _CollapsibleSectionState extends State<_CollapsibleSection> {
  late bool _open;

  @override
  void initState() {
    super.initState();
    _open = widget.initiallyOpen;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[200]!),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          // Header
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Icon(widget.icon, size: 18, color: Colors.grey[600]),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                  ),
                  if (widget.isLive)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color:
                            NucleusColors.accentTeal.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Live',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: NucleusColors.accentTeal,
                        ),
                      ),
                    )
                  else
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Soon',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: Colors.grey[400],
                        ),
                      ),
                    ),
                  Icon(
                    _open
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    size: 18,
                    color: Colors.grey[400],
                  ),
                ],
              ),
            ),
          ),

          // Body
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: Colors.grey[100]!),
                ),
              ),
              child: widget.child ??
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Center(
                      child: Text(
                        'Data will appear here once integrated',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey[400],
                        ),
                      ),
                    ),
                  ),
            ),
            crossFadeState:
                _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Expenses section
// ---------------------------------------------------------------------------

class _ExpensesSection extends StatefulWidget {
  final String personId;

  const _ExpensesSection({required this.personId});

  @override
  State<_ExpensesSection> createState() => _ExpensesSectionState();
}

class _ExpensesSectionState extends State<_ExpensesSection> {
  List<Map<String, dynamic>>? _claims;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadExpenses();
  }

  Future<void> _loadExpenses() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      // Temporarily set user to fetch their expenses
      final resp = await api.get('/expenses',
          queryParams: {'role': 'claimant'});
      final data = resp['data'];
      final list = data?['claims'] ?? data ?? [];
      if (mounted) {
        setState(() {
          _claims = List<Map<String, dynamic>>.from(
              list is List ? list : []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _claims = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Column(
        children: List.generate(
          3,
          (_) => Container(
            height: 36,
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
      );
    }

    if (_claims == null || _claims!.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Text(
            'No expense claims on record',
            style: TextStyle(fontSize: 11, color: Colors.grey[400]),
          ),
        ),
      );
    }

    final total = _claims!.fold<double>(
        0, (s, c) => s + ((c['amount'] as num?)?.toDouble() ?? 0));
    final pending = _claims!
        .where((c) =>
            c['status'] == 'pending' || c['status'] == 'queried')
        .length;
    final approved =
        _claims!.where((c) => c['status'] == 'approved').length;
    final recent = List<Map<String, dynamic>>.from(_claims!)
      ..sort((a, b) =>
          (b['date'] ?? '').toString().compareTo((a['date'] ?? '').toString()));
    final recentSlice = recent.take(5).toList();

    final currFmt =
        NumberFormat.currency(locale: 'en_GB', symbol: '\u00A3');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary strip
        Row(
          children: [
            _StatChip(label: 'Total spend', value: currFmt.format(total)),
            const SizedBox(width: 8),
            _StatChip(label: 'Pending', value: '$pending'),
            const SizedBox(width: 8),
            _StatChip(label: 'Approved', value: '$approved'),
          ],
        ),

        const SizedBox(height: 10),

        // Recent claims header
        Text(
          'RECENT CLAIMS',
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: Colors.grey[400],
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 4),

        // Claims list
        ...recentSlice.map((c) {
          final category = c['category'] ?? '';
          final amount = (c['amount'] as num?)?.toDouble() ?? 0;
          final status = c['status'] ?? '';
          final date = _fmtShortDate(c['date']);

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                Icon(categoryIcon(category),
                    size: 16, color: NucleusColors.accentTeal),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c['description'] ?? category,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: NucleusColors.primaryNavy,
                        ),
                      ),
                      Text(
                        date,
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[400],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      currFmt.format(amount),
                      style: NucleusTheme.monoAmount(
                        fontSize: 11,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                    StatusBadge(status: status, fontSize: 9),
                  ],
                ),
              ],
            ),
          );
        }),

        if (_claims!.length > 5)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Center(
              child: Text(
                '+${_claims!.length - 5} more claim${_claims!.length - 5 != 1 ? 's' : ''}',
                style: TextStyle(fontSize: 10, color: Colors.grey[400]),
              ),
            ),
          ),
      ],
    );
  }

  String _fmtShortDate(dynamic d) {
    if (d == null) return '\u2014';
    try {
      return DateFormat('d MMM').format(DateTime.parse(d.toString()));
    } catch (_) {
      return d.toString();
    }
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;

  const _StatChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.grey[50],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: NucleusTheme.monoAmount(
                fontSize: 11,
                color: NucleusColors.primaryNavy,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label.toUpperCase(),
              style: TextStyle(
                fontSize: 8,
                fontWeight: FontWeight.w700,
                color: Colors.grey[400],
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
