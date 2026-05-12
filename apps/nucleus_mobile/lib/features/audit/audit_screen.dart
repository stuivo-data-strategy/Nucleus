import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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

const _flagReasons = [
  'Receipt unclear/illegible',
  'Amount mismatch',
  'Missing information',
  'Unusual pattern',
  'Requires management confirmation',
  'VAT query',
];

final _currFmt = NumberFormat.currency(locale: 'en_GB', symbol: '£');

String _fmtDate(String? d) {
  if (d == null || d.isEmpty) return '—';
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(d));
  } catch (_) {
    return d;
  }
}

double _vat(double amount) => amount / 6;

// ---------------------------------------------------------------------------
// Audit Screen
// ---------------------------------------------------------------------------

class AuditScreen extends StatefulWidget {
  const AuditScreen({super.key});

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  List<Map<String, dynamic>> _queue = [];
  List<Map<String, dynamic>> _flagged = [];
  Map<String, dynamic>? _stats;
  bool _loading = true;
  final Set<String> _selected = {};
  bool _batchClearing = false;
  int _clearedCount = 0;
  double _clearedAmount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      final results = await Future.wait([
        api.get('/audit/queue'),
        api.get('/audit/flagged'),
        api.get('/audit/stats'),
      ]);

      setState(() {
        _queue = _toList(results[0]['data']?['claims']);
        _flagged = _toList(results[1]['data']?['claims']);
        _stats = results[2]['data'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _toList(dynamic data) {
    if (data is! List) return [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  void _handleCleared(String id, double amount) {
    setState(() {
      _queue.removeWhere((c) => c['id'] == id);
      _selected.remove(id);
      _clearedCount++;
      _clearedAmount += amount;
      if (_stats != null) {
        _stats!['ready_for_audit'] =
            ((_stats!['ready_for_audit'] as num?) ?? 1).toInt() - 1;
        _stats!['cleared_today'] =
            ((_stats!['cleared_today'] as num?) ?? 0).toInt() + 1;
      }
    });
  }

  void _handleFlagged(String id) {
    final claim = _queue.firstWhere((c) => c['id'] == id, orElse: () => {});
    setState(() {
      _queue.removeWhere((c) => c['id'] == id);
      _selected.remove(id);
      if (claim.isNotEmpty) {
        _flagged.insert(0, {...claim, 'audit_status': 'flagged'});
      }
      if (_stats != null) {
        _stats!['ready_for_audit'] =
            ((_stats!['ready_for_audit'] as num?) ?? 1).toInt() - 1;
        _stats!['flagged'] =
            ((_stats!['flagged'] as num?) ?? 0).toInt() + 1;
      }
    });
  }

  void _handleResolved(String id) {
    final claim = _flagged.firstWhere((c) => c['id'] == id, orElse: () => {});
    setState(() {
      _flagged.removeWhere((c) => c['id'] == id);
      if (claim.isNotEmpty) {
        _queue.add({
          ...claim,
          'audit_status': 'pending_audit',
          'audit_flag': null,
        });
      }
      if (_stats != null) {
        _stats!['flagged'] =
            ((_stats!['flagged'] as num?) ?? 1).toInt() - 1;
        _stats!['ready_for_audit'] =
            ((_stats!['ready_for_audit'] as num?) ?? 0).toInt() + 1;
      }
    });
  }

  Future<void> _batchClear() async {
    if (_selected.isEmpty) return;
    setState(() => _batchClearing = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      await api.post('/audit/batch-clear', body: {
        'claim_ids': _selected.toList(),
      });

      final totalAmount = _queue
          .where((c) => _selected.contains(c['id']))
          .fold<double>(
              0, (sum, c) => sum + ((c['claim_amount'] ?? c['amount'] ?? 0) as num).toDouble());

      setState(() {
        _queue.removeWhere((c) => _selected.contains(c['id']));
        _clearedCount += _selected.length;
        _clearedAmount += totalAmount;
        if (_stats != null) {
          _stats!['ready_for_audit'] =
              ((_stats!['ready_for_audit'] as num?) ?? _selected.length).toInt() -
                  _selected.length;
          _stats!['cleared_today'] =
              ((_stats!['cleared_today'] as num?) ?? 0).toInt() +
                  _selected.length;
        }
        _selected.clear();
        _batchClearing = false;
      });
    } catch (_) {
      setState(() => _batchClearing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final isAuditor = user?.isAuditor ?? false;

    if (!isAuditor) {
      return const _AccessDenied();
    }

    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Scaffold(
      backgroundColor: NucleusColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: EdgeInsets.symmetric(
                horizontal: isDesktop ? 32 : 16,
                vertical: isDesktop ? 24 : 16,
              ),
              children: [
                _buildHeader(isDesktop),
                const SizedBox(height: 20),
                _buildStats(isDesktop),
                const SizedBox(height: 24),
                _buildQueueHeader(),
                const SizedBox(height: 12),
                if (_queue.isEmpty)
                  _buildEmptyQueue()
                else
                  ..._queue.map((claim) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _AuditCard(
                          claim: claim,
                          selected: _selected.contains(claim['id']),
                          onToggleSelect: (id) => setState(() {
                            if (_selected.contains(id)) {
                              _selected.remove(id);
                            } else {
                              _selected.add(id);
                            }
                          }),
                          onCleared: _handleCleared,
                          onFlagged: _handleFlagged,
                        ),
                      )),
                if (_flagged.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _buildFlaggedHeader(),
                  const SizedBox(height: 12),
                  ..._flagged.map((claim) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _AuditCard(
                          claim: claim,
                          selected: false,
                          onToggleSelect: (_) {},
                          onCleared: _handleCleared,
                          onFlagged: (_) {},
                          isFlaggedSection: true,
                          onResolved: _handleResolved,
                        ),
                      )),
                ],
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildHeader(bool isDesktop) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Expense Audit',
                style: TextStyle(
                  fontSize: isDesktop ? 28 : 22,
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Review approved claims before payment processing',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
            ],
          ),
        ),
        if (_clearedCount > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: NucleusColors.success.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: NucleusColors.success.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$_clearedCount cleared this session',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.success,
                  ),
                ),
                Text(
                  _currFmt.format(_clearedAmount),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.success,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildStats(bool isDesktop) {
    return GridView.count(
      crossAxisCount: isDesktop ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: isDesktop ? 2.2 : 1.8,
      children: [
        _StatCard(
          label: 'Ready for Audit',
          value: '${_stats?['ready_for_audit'] ?? _queue.length}',
          sub: 'pending review',
        ),
        _StatCard(
          label: 'Flagged for Review',
          value: '${_stats?['flagged'] ?? _flagged.length}',
          sub: 'need attention',
          highlighted: _flagged.isNotEmpty,
          highlightColor: NucleusColors.warning,
        ),
        _StatCard(
          label: 'Cleared Today',
          value: '${_stats?['cleared_today'] ?? _clearedCount}',
          sub: 'ready for payment',
          highlighted: true,
          highlightColor: NucleusColors.success,
        ),
        _StatCard(
          label: 'Avg Processing',
          value: _stats?['avg_processing_hours'] != null
              ? '${_stats!['avg_processing_hours']}h'
              : '—',
          sub: 'approval to clearance',
        ),
      ],
    );
  }

  Widget _buildQueueHeader() {
    return Row(
      children: [
        const Text(
          'Audit Queue',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: NucleusColors.primaryNavy,
          ),
        ),
        if (_queue.isNotEmpty) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: NucleusColors.primaryNavy,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '${_queue.length}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
        const Spacer(),
        if (_queue.isNotEmpty) ...[
          TextButton(
            onPressed: () => setState(() {
              if (_selected.length == _queue.length) {
                _selected.clear();
              } else {
                _selected.addAll(_queue.map((c) => c['id'] as String));
              }
            }),
            child: Text(
              _selected.length == _queue.length ? 'Deselect all' : 'Select all',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: NucleusColors.accentTeal,
              ),
            ),
          ),
          if (_selected.isNotEmpty)
            FilledButton.icon(
              onPressed: _batchClearing ? null : _batchClear,
              icon: _batchClearing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.check, size: 16),
              label: Text('Clear ${_selected.length} selected'),
              style: FilledButton.styleFrom(
                backgroundColor: NucleusColors.success,
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
            ),
        ],
      ],
    );
  }

  Widget _buildEmptyQueue() {
    return Container(
      padding: const EdgeInsets.all(48),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black12, style: BorderStyle.solid),
      ),
      child: Column(
        children: [
          const Icon(Icons.check_circle, size: 40, color: NucleusColors.approved),
          const SizedBox(height: 12),
          const Text(
            'Queue is clear',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: NucleusColors.primaryNavy,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'All approved claims have been processed',
            style: TextStyle(fontSize: 13, color: Colors.black54),
          ),
          if (_clearedCount > 0) ...[
            const SizedBox(height: 12),
            Text(
              '$_clearedCount cleared · ${_currFmt.format(_clearedAmount)}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: NucleusColors.success,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFlaggedHeader() {
    return Row(
      children: [
        const Text(
          'Flagged for Review',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: Color(0xFFB45309), // amber-700
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: NucleusColors.warning,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '${_flagged.length}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

class _AccessDenied extends StatelessWidget {
  const _AccessDenied();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock, size: 48, color: Colors.grey),
          SizedBox(height: 12),
          Text(
            'Audit access required',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 18,
              color: NucleusColors.primaryNavy,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Switch to Lisa Thornton (Expenses Officer)\nto access the audit queue.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final bool highlighted;
  final Color highlightColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.sub,
    this.highlighted = false,
    this.highlightColor = NucleusColors.primaryNavy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlighted
            ? highlightColor.withValues(alpha: 0.06)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlighted
              ? highlightColor.withValues(alpha: 0.3)
              : Colors.black12,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: highlighted
                  ? highlightColor.withValues(alpha: 0.6)
                  : Colors.black38,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: highlighted ? highlightColor : NucleusColors.primaryNavy,
            ),
          ),
          Text(
            sub,
            style: TextStyle(
              fontSize: 11,
              color: highlighted
                  ? highlightColor.withValues(alpha: 0.6)
                  : Colors.black38,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Audit Card
// ---------------------------------------------------------------------------

class _AuditCard extends StatefulWidget {
  final Map<String, dynamic> claim;
  final bool selected;
  final ValueChanged<String> onToggleSelect;
  final void Function(String id, double amount) onCleared;
  final ValueChanged<String> onFlagged;
  final bool isFlaggedSection;
  final ValueChanged<String>? onResolved;

  const _AuditCard({
    required this.claim,
    required this.selected,
    required this.onToggleSelect,
    required this.onCleared,
    required this.onFlagged,
    this.isFlaggedSection = false,
    this.onResolved,
  });

  @override
  State<_AuditCard> createState() => _AuditCardState();
}

enum _ActionState { idle, clearing, flagging, resolving, doneFlag, doneClear, doneResolve }

class _AuditCardState extends State<_AuditCard> {
  _ActionState _actionState = _ActionState.idle;
  bool _flagFormOpen = false;

  Map<String, dynamic> get c => widget.claim;

  double get _claimAmount =>
      ((c['claim_amount'] ?? c['amount'] ?? 0) as num).toDouble();
  double get _receiptAmount =>
      ((c['receipt_amount'] ?? c['amount'] ?? 0) as num).toDouble();

  double? get _policyLimit {
    final checks = (c['policy_result']?['checks'] as List<dynamic>?) ?? [];
    for (final check in checks) {
      if (check is Map && check['rule_name'] == 'Category Limit') {
        return (check['details']?['limit'] as num?)?.toDouble();
      }
    }
    return null;
  }

  bool get _withinLimit => _policyLimit == null || _claimAmount <= _policyLimit!;

  Future<void> _clear() async {
    setState(() => _actionState = _ActionState.clearing);
    try {
      final api = context.read<AuthProvider>().apiClient;
      await api.post('/audit/${Uri.encodeComponent(c['id'])}/clear');
      setState(() => _actionState = _ActionState.doneClear);
      Future.delayed(const Duration(milliseconds: 700), () {
        widget.onCleared(c['id'], _claimAmount);
      });
    } catch (_) {
      setState(() => _actionState = _ActionState.idle);
    }
  }

  Future<void> _flag(String reason, String notes) async {
    setState(() {
      _actionState = _ActionState.flagging;
      _flagFormOpen = false;
    });
    try {
      final api = context.read<AuthProvider>().apiClient;
      await api.post('/audit/${Uri.encodeComponent(c['id'])}/flag', body: {
        'reason': reason,
        'notes': notes,
      });
      setState(() => _actionState = _ActionState.doneFlag);
      Future.delayed(const Duration(milliseconds: 700), () {
        widget.onFlagged(c['id']);
      });
    } catch (_) {
      setState(() => _actionState = _ActionState.idle);
    }
  }

  Future<void> _resolve() async {
    setState(() => _actionState = _ActionState.resolving);
    try {
      final api = context.read<AuthProvider>().apiClient;
      await api.post('/audit/${Uri.encodeComponent(c['id'])}/resolve');
      setState(() => _actionState = _ActionState.doneResolve);
      Future.delayed(const Duration(milliseconds: 700), () {
        widget.onResolved?.call(c['id']);
      });
    } catch (_) {
      setState(() => _actionState = _ActionState.idle);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDone = _actionState == _ActionState.doneClear ||
        _actionState == _ActionState.doneFlag ||
        _actionState == _ActionState.doneResolve;

    final catKey = (c['category'] ?? '').toString();
    final catLabel = _categories[catKey] ?? catKey;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 300),
      opacity: isDone ? 0.0 : 1.0,
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: widget.isFlaggedSection
                ? NucleusColors.warning.withValues(alpha: 0.3)
                : widget.selected
                    ? NucleusColors.accentTeal
                    : Colors.black12,
          ),
        ),
        color: widget.isFlaggedSection
            ? NucleusColors.warning.withValues(alpha: 0.03)
            : Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header row ──────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Checkbox
                  if (!widget.isFlaggedSection)
                    GestureDetector(
                      onTap: () => widget.onToggleSelect(c['id']),
                      child: Container(
                        width: 22,
                        height: 22,
                        margin: const EdgeInsets.only(right: 10, top: 2),
                        decoration: BoxDecoration(
                          color: widget.selected
                              ? NucleusColors.accentTeal
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: widget.selected
                                ? NucleusColors.accentTeal
                                : Colors.black26,
                            width: 2,
                          ),
                        ),
                        child: widget.selected
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : null,
                      ),
                    ),

                  // Avatar
                  Container(
                    width: 36,
                    height: 36,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: const BoxDecoration(
                      color: NucleusColors.primaryNavy,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      (c['claimant_initials'] ?? '').toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),

                  // Identity
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              (c['claimant_name'] ?? '').toString(),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: NucleusColors.primaryNavy,
                              ),
                            ),
                            Text(
                              (c['claimant_job_title'] ?? '').toString(),
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.black45),
                            ),
                            Text(
                              (c['reference'] ?? '').toString(),
                              style: NucleusTheme.monoAmount(
                                  fontSize: 11, color: Colors.black26),
                            ),
                            if (c['exception_requested'] == true)
                              _badge('Exception', NucleusColors.warning),
                            if (c['partial_claim'] == true)
                              _badge('Partial', const Color(0xFF3b82f6)),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(categoryIcon(catKey), size: 13, color: Colors.black54),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${c['description'] ?? catLabel} · ${_fmtDate(c['date']?.toString())}',
                                style: const TextStyle(fontSize: 12, color: Colors.black54),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Amount
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _currFmt.format(_claimAmount),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: NucleusColors.primaryNavy,
                        ),
                      ),
                      Text(
                        'VAT: ${_currFmt.format(_vat(_claimAmount))}',
                        style: NucleusTheme.monoAmount(
                            fontSize: 10, color: Colors.black38),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // ── Comparison grid ─────────────────────────────
              Row(
                children: [
                  _ComparisonCell(
                    label: 'Receipt',
                    value: _currFmt.format(_receiptAmount),
                    sub: c['partial_claim'] == true &&
                            _receiptAmount != _claimAmount
                        ? 'Full receipt'
                        : null,
                  ),
                  const SizedBox(width: 8),
                  _ComparisonCell(
                    label: 'Claimed',
                    value: _currFmt.format(_claimAmount),
                    highlighted: c['partial_claim'] == true &&
                        _receiptAmount != _claimAmount,
                    highlightColor: NucleusColors.warning,
                    sub: c['partial_claim'] == true &&
                            _receiptAmount != _claimAmount
                        ? 'Δ ${_currFmt.format(_receiptAmount - _claimAmount)}'
                        : null,
                  ),
                  const SizedBox(width: 8),
                  _ComparisonCell(
                    label: 'Limit',
                    value: _policyLimit != null
                        ? _currFmt.format(_policyLimit!)
                        : '—',
                    highlighted: true,
                    highlightColor:
                        _withinLimit ? NucleusColors.success : NucleusColors.error,
                    sub: _withinLimit ? '✓ Within' : '✗ Exceeds',
                  ),
                ],
              ),

              // Partial reason
              if (c['partial_claim'] == true && c['partial_reason'] != null) ...[
                const SizedBox(height: 8),
                _infoBanner(
                  'Reason: ${c['partial_reason'].toString().replaceAll('_', ' ')}',
                  NucleusColors.warning,
                ),
              ],

              // Exception justification
              if (c['exception_requested'] == true &&
                  c['exception_justification'] != null) ...[
                const SizedBox(height: 8),
                _infoBanner(
                  'Exception: "${c['exception_justification']}"',
                  NucleusColors.warning,
                ),
              ],

              const SizedBox(height: 10),

              // ── Status badges ───────────────────────────────
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _policyBadge(),
                  _receiptBadge(),
                  _approverBadge(),
                  if (widget.isFlaggedSection && c['audit_flag']?['reason'] != null)
                    _badge(
                      c['audit_flag']['reason'],
                      NucleusColors.warning,
                    ),
                ],
              ),

              // Flag form
              if (_flagFormOpen) ...[
                const SizedBox(height: 12),
                _FlagForm(
                  onSubmit: _flag,
                  onCancel: () => setState(() => _flagFormOpen = false),
                ),
              ],

              const SizedBox(height: 12),

              // ── Action buttons ──────────────────────────────
              if (!widget.isFlaggedSection)
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _actionState == _ActionState.idle ? _clear : null,
                        icon: _actionState == _ActionState.clearing
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : _actionState == _ActionState.doneClear
                                ? const Icon(Icons.check, size: 16)
                                : const Icon(Icons.check, size: 16),
                        label: Text(
                          _actionState == _ActionState.doneClear
                              ? 'Cleared'
                              : 'Clear for Payment',
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: NucleusColors.success,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          textStyle: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: _actionState == _ActionState.idle
                          ? () => setState(() => _flagFormOpen = !_flagFormOpen)
                          : null,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _flagFormOpen
                            ? Colors.white
                            : const Color(0xFFB45309),
                        backgroundColor: _flagFormOpen
                            ? NucleusColors.warning
                            : NucleusColors.warning.withValues(alpha: 0.06),
                        side: BorderSide(
                          color: NucleusColors.warning.withValues(alpha: 0.4),
                        ),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        textStyle: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.warning_amber, size: 16),
                          const SizedBox(width: 4),
                          Text(_actionState == _ActionState.doneFlag
                              ? 'Flagged'
                              : 'Flag'),
                        ],
                      ),
                    ),
                  ],
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed:
                        _actionState == _ActionState.idle ? _resolve : null,
                    icon: _actionState == _ActionState.resolving
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.undo, size: 16),
                    label: Text(
                      _actionState == _ActionState.doneResolve
                          ? '✓ Returned to Queue'
                          : 'Return to Queue',
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: NucleusColors.accentTeal,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      textStyle: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _policyBadge() {
    final result = c['policy_result'];
    if (result == null) {
      return _badge('No policy data', Colors.grey);
    }
    final summary = result['summary'] as Map<String, dynamic>? ?? {};
    final passed = (summary['passed'] as num?)?.toInt() ?? 0;
    final total = (summary['total'] as num?)?.toInt() ?? 0;
    final failures = (summary['failures'] as num?)?.toInt() ?? 0;
    final ok = failures == 0;
    return _badge(
      '${ok ? '✓' : '✗'} Policy $passed/$total',
      ok ? NucleusColors.success : NucleusColors.error,
    );
  }

  Widget _receiptBadge() {
    final hasReceipt = c['has_receipt'] == true;
    return _badge(
      hasReceipt ? 'Receipt ✓' : 'No receipt',
      hasReceipt ? NucleusColors.success : NucleusColors.error,
    );
  }

  Widget _approverBadge() {
    final steps = (c['workflow']?['steps'] as List<dynamic>?) ?? [];
    final approved =
        steps.where((s) => s is Map && s['status'] == 'approved').toList();
    if (approved.isEmpty) {
      return _badge('No approver', Colors.grey);
    }
    final label = approved.length > 1
        ? '✓ Approved (${approved.length} steps)'
        : '✓ Approved by ${approved.first['approver_name'] ?? ''}';
    return _badge(label, NucleusColors.accentTeal);
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }

  Widget _infoBanner(String text, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 12, color: color),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Comparison cell
// ---------------------------------------------------------------------------

class _ComparisonCell extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final bool highlighted;
  final Color highlightColor;

  const _ComparisonCell({
    required this.label,
    required this.value,
    this.sub,
    this.highlighted = false,
    this.highlightColor = Colors.grey,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: highlighted
              ? highlightColor.withValues(alpha: 0.06)
              : NucleusColors.background,
          borderRadius: BorderRadius.circular(12),
          border: highlighted
              ? Border.all(color: highlightColor.withValues(alpha: 0.2))
              : null,
        ),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.black38,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: highlighted ? highlightColor : NucleusColors.primaryNavy,
              ),
            ),
            if (sub != null) ...[
              const SizedBox(height: 2),
              Text(
                sub!,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: highlighted ? highlightColor : Colors.black38,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Flag form
// ---------------------------------------------------------------------------

class _FlagForm extends StatefulWidget {
  final void Function(String reason, String notes) onSubmit;
  final VoidCallback onCancel;

  const _FlagForm({required this.onSubmit, required this.onCancel});

  @override
  State<_FlagForm> createState() => _FlagFormState();
}

class _FlagFormState extends State<_FlagForm> {
  String? _reason;
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NucleusColors.warning.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: NucleusColors.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'FLAG FOR REVIEW',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
              color: const Color(0xFFB45309),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            hint: const Text('Select reason...'),
            isExpanded: true,
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: NucleusColors.warning.withValues(alpha: 0.4)),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            items: _flagReasons
                .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                .toList(),
            onChanged: (v) => setState(() => _reason = v),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _notesController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'Additional notes (optional)...',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: NucleusColors.warning.withValues(alpha: 0.4)),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            style: const TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: _reason != null
                      ? () =>
                          widget.onSubmit(_reason!, _notesController.text)
                      : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: NucleusColors.warning,
                    disabledBackgroundColor:
                        NucleusColors.warning.withValues(alpha: 0.3),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    textStyle: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.warning_amber, size: 16),
                      SizedBox(width: 4),
                      Text('Confirm Flag'),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: widget.onCancel,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  textStyle: const TextStyle(fontSize: 13),
                ),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
