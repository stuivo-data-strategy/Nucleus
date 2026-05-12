import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../claims/new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _categories = {
  'meals': 'Meals',
  'travel': 'Travel',
  'accommodation': 'Hotel',
  'transport': 'Transport',
  'office_supplies': 'Supplies',
  'training': 'Training',
  'mileage': 'Mileage',
  'other': 'Other',
};

final _currencyFmt = NumberFormat.currency(locale: 'en_GB', symbol: '£');

String _formatPersonId(String id) {
  if (id.isEmpty || id == 'system') return 'System';
  return id
      .replaceFirst('person:', '')
      .replaceAll('_', ' ')
      .split(' ')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

String _fmtDateTime(String? d) {
  if (d == null || d.isEmpty) return '—';
  try {
    final dt = DateTime.parse(d);
    return '${DateFormat('d MMM yyyy').format(dt)} · ${DateFormat('HH:mm').format(dt)}';
  } catch (_) {
    return d;
  }
}

String _describeChange(Map<String, dynamic> entry) {
  final r = entry['result'];
  if (r == null || r is! Map) return 'Policy updated';

  final previous = r['previous'] as Map<String, dynamic>? ?? {};
  final updated = r['updated'] as Map<String, dynamic>? ?? {};
  final changes = r['changes'] as Map<String, dynamic>? ?? {};
  final raw = (updated['category'] ?? previous['category'] ?? '').toString();
  final cat = _categories[raw] ?? raw.replaceAll('_', ' ');

  final parts = <String>[];

  if (changes.containsKey('max_amount')) {
    final from = previous['max_amount'];
    final to = changes['max_amount'];
    parts.add(from != null
        ? '$cat spending limit changed from ${_currencyFmt.format(from)} to ${_currencyFmt.format(to)}'
        : '$cat spending limit set to ${_currencyFmt.format(to)}');
  }
  if (changes.containsKey('receipt_threshold')) {
    final from = previous['receipt_threshold'];
    final to = changes['receipt_threshold'];
    parts.add(from != null
        ? '$cat receipt threshold changed from ${_currencyFmt.format(from)} to ${_currencyFmt.format(to)}'
        : '$cat receipt threshold set to ${_currencyFmt.format(to)}');
  }
  if (changes.containsKey('per_diem_rate')) {
    final from = previous['per_diem_rate'];
    final to = changes['per_diem_rate'];
    parts.add(from != null
        ? '$cat per diem changed from ${_currencyFmt.format(from)} to ${_currencyFmt.format(to)}'
        : '$cat per diem set to ${_currencyFmt.format(to)}');
  }

  return parts.isNotEmpty ? parts.join('; ') : '$cat policy updated';
}

// ---------------------------------------------------------------------------
// Policy Screen
// ---------------------------------------------------------------------------

class PolicyScreen extends StatefulWidget {
  const PolicyScreen({super.key});

  @override
  State<PolicyScreen> createState() => _PolicyScreenState();
}

class _PolicyScreenState extends State<PolicyScreen> {
  List<Map<String, dynamic>> _rules = [];
  List<Map<String, dynamic>> _auditLog = [];
  Map<String, dynamic>? _thresholds;
  bool _loading = true;
  String? _error;
  bool _demoTipOpen = false;

  @override
  void initState() {
    super.initState();
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<AuthProvider>().apiClient;
      final results = await Future.wait([
        api.get('/policies/rules'),
        api.get('/policies/audit/POLICY_CHANGE'),
        api.get('/policies/thresholds'),
      ]);

      final rulesData = (results[0]['data'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      final auditData = (results[1]['data'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];

      setState(() {
        _rules = rulesData;
        _auditLog = auditData.reversed.toList();
        _thresholds = results[2]['data'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load policy data';
        _loading = false;
      });
    }
  }

  Future<void> _updateRule(String category, String field, double value) async {
    final api = context.read<AuthProvider>().apiClient;
    final response = await api.patch(
      '/policies/rules/category/$category',
      body: {field: value},
    );

    // Update local state
    final updated = response['data'] as Map<String, dynamic>?;
    if (updated != null) {
      setState(() {
        _rules = _rules.map((r) {
          if (r['category'] == category) {
            return {...r, ...updated};
          }
          return r;
        }).toList();
      });
    }

    // Refresh audit log
    try {
      final auditResponse = await api.get('/policies/audit/POLICY_CHANGE');
      final auditData = (auditResponse['data'] as List<dynamic>?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
      setState(() => _auditLog = auditData.reversed.toList());
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Scaffold(
      backgroundColor: NucleusColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _buildContent(isDesktop),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_error!, style: const TextStyle(color: NucleusColors.error)),
          const SizedBox(height: 12),
          TextButton(onPressed: _fetchAll, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildContent(bool isDesktop) {
    return ListView(
      padding: EdgeInsets.symmetric(
        horizontal: isDesktop ? 32 : 16,
        vertical: isDesktop ? 24 : 16,
      ),
      children: [
        // Header
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Policy Administration',
                    style: TextStyle(
                      fontSize: isDesktop ? 28 : 22,
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Spending limits and receipt rules are live data. Changes take effect immediately.',
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: NucleusColors.success.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: NucleusColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: NucleusColors.success,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Live · SurrealDB',
                    style: TextStyle(
                      color: NucleusColors.success,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),

        // Demo tip
        _buildDemoTip(),

        const SizedBox(height: 20),

        // Policy rules table
        _buildRulesCard(isDesktop),

        const SizedBox(height: 20),

        // Approval chain diagram
        _buildApprovalChain(isDesktop),

        const SizedBox(height: 20),

        // Delegation placeholder
        _buildPlaceholderCard(
          title: 'Delegated Approval Routing',
          subtitle: 'Route approvals to a designated delegate when the primary approver is unavailable',
          items: [
            ('Delegate Assignment', 'Assign a named delegate per approver role'),
            ('Delegation Period', 'Set start and end dates for active delegation'),
            ('Delegation Scope', 'Limit delegation to specific claim categories or amounts'),
          ],
        ),

        const SizedBox(height: 20),

        // SLA placeholder
        _buildPlaceholderCard(
          title: 'SLA-based Escalation Routing',
          subtitle: 'Automatically escalate to the next approver if not actioned within a defined SLA period',
          items: [
            ('SLA Period', 'Hours before an unanswered approval triggers escalation'),
            ('Escalation Target', 'Who receives the claim when SLA is breached'),
            ('Reminder Cadence', 'Notify the original approver before SLA expires'),
          ],
        ),

        const SizedBox(height: 20),

        // Audit log
        _buildAuditLog(),

        const SizedBox(height: 32),
      ],
    );
  }

  // ─── Demo Tip ────────────────────────────────────────────────────────────

  Widget _buildDemoTip() {
    return Card(
      color: NucleusColors.accentTeal.withValues(alpha: 0.06),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: NucleusColors.accentTeal.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _demoTipOpen = !_demoTipOpen),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.adjust, size: 18, color: NucleusColors.accentTeal),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Demo Script — "Change a Rule, See It Enforced"',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: NucleusColors.accentTeal,
                      ),
                    ),
                  ),
                  Icon(
                    _demoTipOpen ? Icons.expand_less : Icons.chevron_right,
                    color: NucleusColors.accentTeal,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                children: [
                  'Note that the Meals spending limit is £75.00.',
                  'Go to My Claims → New Claim → select Meals → type £80 → see red "Exceeds limit".',
                  'Come back here → change the Meals limit to £100 → see "Updated ✓".',
                  'Go to My Claims → New Claim → select Meals → type £80 → see green "Within limit".',
                  'Change it back to £75 → the £80 claim is blocked again. Policy is live data.',
                ].asMap().entries.map((e) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: NucleusColors.accentTeal,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${e.key + 1}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            e.value,
                            style: TextStyle(
                              fontSize: 13,
                              color: NucleusColors.primaryNavy.withValues(alpha: 0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            crossFadeState:
                _demoTipOpen ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }

  // ─── Policy Rules Table ──────────────────────────────────────────────────

  Widget _buildRulesCard(bool isDesktop) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Spending Limits & Receipt Rules',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: NucleusColors.primaryNavy,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Tap any dashed value to edit — changes are saved instantly',
                        style: TextStyle(fontSize: 11, color: Colors.black45),
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 16,
                      decoration: const BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: Colors.black38,
                            style: BorderStyle.solid,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      '= editable',
                      style: TextStyle(fontSize: 11, color: Colors.black38),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (isDesktop) _buildDesktopTable() else _buildMobileRules(),
        ],
      ),
    );
  }

  Widget _buildDesktopTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(12),
      child: DataTable(
        columnSpacing: 24,
        headingRowHeight: 40,
        dataRowMinHeight: 52,
        dataRowMaxHeight: 56,
        headingTextStyle: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: Colors.black45,
          letterSpacing: 1,
        ),
        columns: const [
          DataColumn(label: Text('CATEGORY')),
          DataColumn(label: Text('SPENDING LIMIT'), numeric: true),
          DataColumn(label: Text('RECEIPT ABOVE'), numeric: true),
          DataColumn(label: Text('PER DIEM'), numeric: true),
          DataColumn(label: Text('GL CODE'), numeric: true),
          DataColumn(label: Text('VAT'), numeric: true),
        ],
        rows: _rules.map((rule) {
          final catKey = (rule['category'] ?? '').toString();
          final label = _categories[catKey] ?? catKey;

          return DataRow(cells: [
            DataCell(Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(categoryIcon(catKey), size: 16, color: NucleusColors.accentTeal),
                const SizedBox(width: 8),
                Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: NucleusColors.primaryNavy)),
              ],
            )),
            DataCell(_EditableCell(
              value: (rule['max_amount'] as num?)?.toDouble(),
              onSave: (v) => _updateRule(catKey, 'max_amount', v),
            )),
            DataCell(_EditableCell(
              value: (rule['receipt_threshold'] as num?)?.toDouble(),
              onSave: (v) => _updateRule(catKey, 'receipt_threshold', v),
            )),
            DataCell(_EditableCell(
              value: (rule['per_diem_rate'] as num?)?.toDouble(),
              onSave: (v) => _updateRule(catKey, 'per_diem_rate', v),
            )),
            DataCell(Text(
              (rule['gl_code'] ?? '—').toString(),
              style: NucleusTheme.monoAmount(fontSize: 12, color: Colors.black45),
            )),
            DataCell(Text(
              rule['vat_rate'] != null
                  ? '${((rule['vat_rate'] as num) * 100).toStringAsFixed(0)}%'
                  : '—',
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            )),
          ]);
        }).toList(),
      ),
    );
  }

  Widget _buildMobileRules() {
    return Column(
      children: _rules.map((rule) {
        final catKey = (rule['category'] ?? '').toString();
        final label = _categories[catKey] ?? catKey;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Colors.black12)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(categoryIcon(catKey), size: 18, color: NucleusColors.accentTeal),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _MobileRuleField(
                      label: 'Spending Limit',
                      value: (rule['max_amount'] as num?)?.toDouble(),
                      onSave: (v) => _updateRule(catKey, 'max_amount', v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MobileRuleField(
                      label: 'Receipt Above',
                      value: (rule['receipt_threshold'] as num?)?.toDouble(),
                      onSave: (v) => _updateRule(catKey, 'receipt_threshold', v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MobileRuleField(
                      label: 'Per Diem',
                      value: (rule['per_diem_rate'] as num?)?.toDouble(),
                      onSave: (v) => _updateRule(catKey, 'per_diem_rate', v),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // ─── Approval Chain ──────────────────────────────────────────────────────

  Widget _buildApprovalChain(bool isDesktop) {
    final ccAbove = (_thresholds?['cc_owner_above'] as num?)?.toInt() ?? 100;
    final finAbove = (_thresholds?['finance_above'] as num?)?.toInt() ?? 500;

    final tiers = [
      (
        'Under £25 (with receipt)',
        [('Auto-Approved', '✓', Colors.grey)],
        true,
      ),
      (
        '£25 – £${ccAbove - 1}',
        [('Line Manager', '①', NucleusColors.accentTeal)],
        false,
      ),
      (
        '£$ccAbove – £${finAbove - 1}',
        [
          ('Line Manager', '①', NucleusColors.accentTeal),
          ('Cost Centre Owner', '②', NucleusColors.primaryNavy),
        ],
        false,
      ),
      (
        '£$finAbove+',
        [
          ('Line Manager', '①', NucleusColors.accentTeal),
          ('Cost Centre Owner', '②', NucleusColors.primaryNavy),
          ('Finance', '③', NucleusColors.warning),
        ],
        false,
      ),
    ];

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Approval Routing — Amount Thresholds',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Claim amount determines how many approvers are required',
                  style: TextStyle(fontSize: 11, color: Colors.black45),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: tiers.asMap().entries.map((e) {
                final (range, steps, dimmed) = e.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Opacity(
                    opacity: dimmed ? 0.6 : 1.0,
                    child: isDesktop
                        ? _buildDesktopTier(range, steps)
                        : _buildMobileTier(range, steps),
                  ),
                );
              }).toList(),
            ),
          ),
          // Graph routing note
          Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: NucleusColors.primaryNavy.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: NucleusColors.primaryNavy.withValues(alpha: 0.1),
              ),
            ),
            child: Text(
              'Graph-based routing — Approvers are resolved from the organisation hierarchy at submission time. '
              'When an employee\'s reporting line changes, routing updates automatically.',
              style: TextStyle(
                fontSize: 12,
                color: NucleusColors.primaryNavy.withValues(alpha: 0.7),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopTier(
      String range, List<(String, String, Color)> steps) {
    return Row(
      children: [
        SizedBox(
          width: 140,
          child: Text(
            range,
            textAlign: TextAlign.right,
            style: NucleusTheme.monoAmount(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: NucleusColors.primaryNavy,
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 8),
          child: Icon(Icons.arrow_forward, size: 16, color: Colors.black26),
        ),
        ...steps.asMap().entries.expand((e) {
          final (label, icon, color) = e.value;
          return [
            if (e.key > 0)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Icon(Icons.arrow_forward, size: 14, color: Colors.black26),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(icon,
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold, color: color)),
                  const SizedBox(width: 6),
                  Text(label,
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold, color: color)),
                ],
              ),
            ),
          ];
        }),
      ],
    );
  }

  Widget _buildMobileTier(
      String range, List<(String, String, Color)> steps) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          range,
          style: NucleusTheme.monoAmount(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: NucleusColors.primaryNavy,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: steps.asMap().entries.expand((e) {
            final (label, icon, color) = e.value;
            return [
              if (e.key > 0)
                const Icon(Icons.arrow_forward, size: 14, color: Colors.black26),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: color.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '$icon $label',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ),
            ];
          }).toList(),
        ),
      ],
    );
  }

  // ─── Placeholder Cards ───────────────────────────────────────────────────

  Widget _buildPlaceholderCard({
    required String title,
    required String subtitle,
    required List<(String, String)> items,
  }) {
    return Opacity(
      opacity: 0.75,
      child: Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                  color: NucleusColors.primaryNavy,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: const Text(
                                'Future development',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black38,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: const TextStyle(
                              fontSize: 11, color: Colors.black45),
                        ),
                      ],
                    ),
                  ),
                  // Disabled toggle
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Off',
                          style: TextStyle(fontSize: 11, color: Colors.black38)),
                      const SizedBox(width: 6),
                      Container(
                        width: 40,
                        height: 22,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.all(2),
                        child: Container(
                          width: 18,
                          height: 18,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: items.map((item) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          margin: const EdgeInsets.only(top: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.$1,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black38,
                                ),
                              ),
                              Text(
                                item.$2,
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.black26),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────

  Widget _buildAuditLog() {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Recent Policy Changes',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: NucleusColors.primaryNavy,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Every rule change is written to the audit log with before/after values',
                        style: TextStyle(fontSize: 11, color: Colors.black45),
                      ),
                    ],
                  ),
                ),
                if (_auditLog.isNotEmpty)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${_auditLog.length} ${_auditLog.length == 1 ? 'change' : 'changes'}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.black38,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (_auditLog.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text(
                  'No policy changes recorded yet. Edit a rule above to create the first entry.',
                  style: TextStyle(fontSize: 13, color: Colors.black38),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            ...(_auditLog.take(15).map((entry) {
              final description = _describeChange(entry);
              final person =
                  _formatPersonId((entry['evaluated_by'] ?? '').toString());
              final timestamp =
                  _fmtDateTime((entry['created_at'] ?? '').toString());

              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: NucleusColors.warning.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: NucleusColors.warning.withValues(alpha: 0.2),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Text('⚙️', style: TextStyle(fontSize: 14)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            description,
                            style: const TextStyle(
                              fontSize: 13,
                              color: NucleusColors.primaryNavy,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'By $person · $timestamp',
                            style: const TextStyle(
                                fontSize: 11, color: Colors.black38),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            })),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Editable cell widget
// ---------------------------------------------------------------------------

class _EditableCell extends StatefulWidget {
  final double? value;
  final Future<void> Function(double) onSave;

  const _EditableCell({required this.value, required this.onSave});

  @override
  State<_EditableCell> createState() => _EditableCellState();
}

enum _FlashState { idle, saving, saved, error }

class _EditableCellState extends State<_EditableCell> {
  bool _editing = false;
  late TextEditingController _ctrl;
  _FlashState _flash = _FlashState.idle;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: widget.value?.toStringAsFixed(2) ?? '',
    );
  }

  @override
  void didUpdateWidget(covariant _EditableCell old) {
    super.didUpdateWidget(old);
    if (!_editing && widget.value != old.value) {
      _ctrl.text = widget.value?.toStringAsFixed(2) ?? '';
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final num = double.tryParse(_ctrl.text);
    if (num == null) {
      setState(() {
        _editing = false;
        _ctrl.text = widget.value?.toStringAsFixed(2) ?? '';
      });
      return;
    }
    if (num == widget.value) {
      setState(() => _editing = false);
      return;
    }

    setState(() {
      _editing = false;
      _flash = _FlashState.saving;
    });

    try {
      await widget.onSave(num);
      setState(() => _flash = _FlashState.saved);
    } catch (_) {
      setState(() {
        _flash = _FlashState.error;
        _ctrl.text = widget.value?.toStringAsFixed(2) ?? '';
      });
    }

    Future.delayed(const Duration(milliseconds: 2200), () {
      if (mounted) setState(() => _flash = _FlashState.idle);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) {
      return SizedBox(
        width: 90,
        child: TextField(
          controller: _ctrl,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textAlign: TextAlign.right,
          style: NucleusTheme.monoAmount(fontSize: 13, color: NucleusColors.primaryNavy),
          decoration: InputDecoration(
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            filled: true,
            fillColor: NucleusColors.accentTeal.withValues(alpha: 0.06),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: NucleusColors.accentTeal, width: 2),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: NucleusColors.accentTeal, width: 2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: NucleusColors.accentTeal, width: 2),
            ),
          ),
          onSubmitted: (_) => _save(),
          onTapOutside: (_) => _save(),
        ),
      );
    }

    // Display mode
    Color bgColor;
    Color borderColor;
    Color textColor;
    String display;

    switch (_flash) {
      case _FlashState.saving:
        bgColor = Colors.transparent;
        borderColor = Colors.grey.shade200;
        textColor = Colors.black38;
        display = '...';
      case _FlashState.saved:
        bgColor = NucleusColors.success.withValues(alpha: 0.06);
        borderColor = NucleusColors.success.withValues(alpha: 0.3);
        textColor = NucleusColors.success;
        display = '£${double.tryParse(_ctrl.text)?.toStringAsFixed(2) ?? '0.00'} ✓';
      case _FlashState.error:
        bgColor = NucleusColors.error.withValues(alpha: 0.06);
        borderColor = NucleusColors.error.withValues(alpha: 0.3);
        textColor = NucleusColors.error;
        display = 'Error';
      case _FlashState.idle:
        bgColor = Colors.transparent;
        borderColor = Colors.black26;
        textColor = NucleusColors.primaryNavy;
        display = widget.value != null
            ? '£${widget.value!.toStringAsFixed(2)}'
            : '—';
    }

    return InkWell(
      onTap: () => setState(() => _editing = true),
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: borderColor,
            style: _flash == _FlashState.idle
                ? BorderStyle.solid
                : BorderStyle.solid,
          ),
        ),
        child: Text(
          display,
          textAlign: TextAlign.right,
          style: NucleusTheme.monoAmount(
            fontSize: 13,
            fontWeight:
                _flash == _FlashState.saved ? FontWeight.bold : FontWeight.w600,
            color: textColor,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mobile rule field
// ---------------------------------------------------------------------------

class _MobileRuleField extends StatelessWidget {
  final String label;
  final double? value;
  final Future<void> Function(double) onSave;

  const _MobileRuleField({
    required this.label,
    required this.value,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.black38,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        _EditableCell(value: value, onSave: onSave),
      ],
    );
  }
}
