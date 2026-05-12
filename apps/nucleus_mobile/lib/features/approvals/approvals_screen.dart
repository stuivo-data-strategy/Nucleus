import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../claims/new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Approvals Screen — manager approval queue
// ---------------------------------------------------------------------------

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _claims = [];
  double _totalPending = 0;

  // Session counters
  int _approvedThisSession = 0;
  double _approvedAmountThisSession = 0;

  @override
  void initState() {
    super.initState();
    _loadApprovals();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    context.read<AuthProvider>().addListener(_onUserChanged);
  }

  void _onUserChanged() {
    if (mounted) {
      _approvedThisSession = 0;
      _approvedAmountThisSession = 0;
      _loadApprovals();
    }
  }

  @override
  void dispose() {
    context.read<AuthProvider>().removeListener(_onUserChanged);
    super.dispose();
  }

  Future<void> _loadApprovals() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final resp =
          await api.get('/expenses', queryParams: {'role': 'approver'});
      final claims =
          List<Map<String, dynamic>>.from(resp['data']?['claims'] ?? []);

      _totalPending = claims.fold(
          0.0, (s, c) => s + ((c['amount'] as num?)?.toDouble() ?? 0));

      setState(() {
        _claims = claims;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _batchApprove() async {
    final api = context.read<ApiClient>();
    for (var i = 0; i < _claims.length; i++) {
      final claim = _claims[i];
      try {
        await api.post('/expenses/${claim['id']}/action', body: {
          'action': 'approve',
        });
        _approvedThisSession++;
        _approvedAmountThisSession +=
            (claim['amount'] as num?)?.toDouble() ?? 0;
      } catch (_) {}
    }
    context.read<AuthProvider>().refreshPendingApprovals();
    _loadApprovals();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _loadApprovals,
        child: CustomScrollView(
          slivers: [
            // Summary cards
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: _SummaryCard(
                        label: 'Awaiting Review',
                        amount: _totalPending,
                        count: _claims.length,
                        icon: Icons.hourglass_empty,
                        color: NucleusColors.warning,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _SummaryCard(
                        label: 'Approved This Session',
                        amount: _approvedAmountThisSession,
                        count: _approvedThisSession,
                        icon: Icons.check_circle,
                        color: NucleusColors.approved,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Batch approve banner
            if (_claims.length >= 3)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: NucleusColors.warning.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: NucleusColors.warning.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.flash_on,
                            size: 18, color: Color(0xFFB45309)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${_claims.length} claims pending — approve all at once?',
                            style: const TextStyle(
                                fontSize: 13, color: Color(0xFFB45309)),
                          ),
                        ),
                        FilledButton(
                          onPressed: _batchApprove,
                          style: FilledButton.styleFrom(
                            backgroundColor: NucleusColors.warning,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            minimumSize: const Size(0, 34),
                          ),
                          child: Text('Approve All (${_claims.length})',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            // Claims list
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_claims.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: NucleusColors.approved.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.check,
                            size: 36, color: NucleusColors.approved),
                      ),
                      const SizedBox(height: 16),
                      Text('All caught up',
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 18,
                              color: Colors.grey[700])),
                      const SizedBox(height: 6),
                      Text(
                        'No claims waiting for your approval',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                      if (_approvedThisSession > 0) ...[
                        const SizedBox(height: 16),
                        Text(
                          'You approved $_approvedThisSession claim${_approvedThisSession == 1 ? '' : 's'} this session',
                          style: TextStyle(
                              fontSize: 13,
                              color: NucleusColors.approved,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    return _ApprovalCard(
                      key: ValueKey(_claims[index]['id']),
                      claim: _claims[index],
                      onAction: (action) async {
                        final amount =
                            (_claims[index]['amount'] as num?)?.toDouble() ?? 0;
                        if (action == 'approved') {
                          _approvedThisSession++;
                          _approvedAmountThisSession += amount;
                        }
                        context.read<AuthProvider>().refreshPendingApprovals();
                        await _loadApprovals();
                      },
                    );
                  },
                  childCount: _claims.length,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

class _SummaryCard extends StatelessWidget {
  final String label;
  final double amount;
  final int count;
  final IconData icon;
  final Color color;

  const _SummaryCard({
    required this.label,
    required this.amount,
    required this.count,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              NumberFormat.currency(locale: 'en_GB', symbol: '£').format(amount),
              style: NucleusTheme.monoAmount(
                fontSize: 18,
                color: NucleusColors.primaryNavy,
              ),
            ),
            if (count > 0)
              Text('$count claim${count == 1 ? '' : 's'}',
                  style: TextStyle(fontSize: 11, color: Colors.grey[500])),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Approval Card — one pending claim
// ---------------------------------------------------------------------------

class _ApprovalCard extends StatefulWidget {
  final Map<String, dynamic> claim;
  final ValueChanged<String> onAction;

  const _ApprovalCard({
    super.key,
    required this.claim,
    required this.onAction,
  });

  @override
  State<_ApprovalCard> createState() => _ApprovalCardState();
}

class _ApprovalCardState extends State<_ApprovalCard>
    with SingleTickerProviderStateMixin {
  bool _queryMode = false;
  final _queryCtrl = TextEditingController();
  bool _acting = false;
  String? _actionResult; // 'approved', 'queried', 'rejected'

  late final AnimationController _dismissCtrl;
  late final Animation<double> _dismissAnim;

  @override
  void initState() {
    super.initState();
    _dismissCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _dismissAnim = CurvedAnimation(parent: _dismissCtrl, curve: Curves.easeIn);
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    _dismissCtrl.dispose();
    super.dispose();
  }

  Future<void> _doAction(String action, {String? note}) async {
    setState(() => _acting = true);
    try {
      final api = context.read<ApiClient>();
      await api.post('/expenses/${widget.claim['id']}/action', body: {
        'action': action,
        if (note != null && note.isNotEmpty) 'note': note,
      });

      final result = action == 'approve'
          ? 'approved'
          : action == 'query'
              ? 'queried'
              : 'rejected';

      setState(() {
        _acting = false;
        _actionResult = result;
      });

      // Auto-dismiss after showing result
      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) {
        await _dismissCtrl.forward();
        widget.onAction(result);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _acting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Action failed: $e')),
        );
      }
    }
  }

  Future<void> _showRejectDialog() async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Claim'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Rejecting ${widget.claim['claimant_name']}\'s claim for ${_fmtGBP(widget.claim['amount'])}',
              style: TextStyle(fontSize: 13, color: Colors.grey[600]),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLines: 3,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Reason for rejection (required)',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (reasonCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx, reasonCtrl.text.trim());
            },
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason != null && reason.isNotEmpty) {
      _doAction('reject', note: reason);
    }
  }

  @override
  Widget build(BuildContext context) {
    // After action — show result then animate out
    if (_actionResult != null) {
      return SizeTransition(
        sizeFactor: Tween<double>(begin: 1, end: 0).animate(_dismissAnim),
        child: _buildActionResult(),
      );
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 10),
            _buildClaimDetails(),
            const SizedBox(height: 10),
            _buildPolicyPanel(),
            _buildPriorApprovals(),
            _buildApproverContext(),
            if (_queryMode) _buildQueryInput(),
            const SizedBox(height: 12),
            _buildActions(),
          ],
        ),
      ),
    );
  }

  // Header: avatar + name + amount
  Widget _buildHeader() {
    final claim = widget.claim;
    final amount = (claim['amount'] as num?)?.toDouble() ?? 0;
    final initials = claim['claimant_initials'] ?? '';

    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: NucleusColors.primaryNavy,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(initials,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                claim['claimant_name'] ?? 'Unknown',
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14),
              ),
              Text(
                claim['claimant_job_title'] ?? '',
                style: TextStyle(fontSize: 12, color: Colors.grey[500]),
              ),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              _fmtGBP(amount),
              style: NucleusTheme.monoAmount(
                  fontSize: 18, color: NucleusColors.primaryNavy),
            ),
            Text(
              claim['reference'] ?? '',
              style: NucleusTheme.mono.copyWith(
                  fontSize: 10, color: Colors.grey[400]),
            ),
          ],
        ),
      ],
    );
  }

  // Claim details row
  Widget _buildClaimDetails() {
    final claim = widget.claim;
    final category = claim['category'] ?? '';
    final hasReceipt = claim['has_receipt'] == true;
    final isException = claim['exception_requested'] == true;
    final isPartial = claim['partial_claim'] == true;

    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: [
        _DetailChip(
            icon: Icon(categoryIcon(category), size: 14, color: Colors.grey[500]),
            label: _categoryLabel(category)),
        _DetailChip(
          icon: Icon(Icons.calendar_today, size: 12, color: Colors.grey[500]),
          label: _fmtDate(claim['date']),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: hasReceipt
                ? NucleusColors.approved.withValues(alpha: 0.08)
                : NucleusColors.warning.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                hasReceipt ? Icons.photo_camera : Icons.warning_amber,
                size: 13,
                color: hasReceipt
                    ? NucleusColors.approved
                    : const Color(0xFFB45309),
              ),
              const SizedBox(width: 4),
              Text(
                hasReceipt ? 'Receipt' : 'No receipt',
                style: TextStyle(
                    fontSize: 11,
                    color: hasReceipt
                        ? NucleusColors.approved
                        : const Color(0xFFB45309)),
              ),
            ],
          ),
        ),
        if (isException)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: NucleusColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.warning_amber, size: 13, color: Color(0xFFB45309)),
                SizedBox(width: 3),
                Text('Exception',
                    style: TextStyle(fontSize: 11, color: Color(0xFFB45309))),
              ],
            ),
          ),
        if (isPartial)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text('Partial claim',
                style: TextStyle(fontSize: 11, color: Colors.blue)),
          ),
      ],
    );
  }

  // Exception / partial banners
  Widget _buildExceptionBanner() {
    final claim = widget.claim;
    final justification = claim['exception_justification'] ?? '';
    if (claim['exception_requested'] != true || justification.isEmpty) {
      return const SizedBox.shrink();
    }
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: NucleusColors.warning.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border:
            Border.all(color: NucleusColors.warning.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning, size: 16, color: Color(0xFFB45309)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Policy Exception Requested',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                        color: Color(0xFFB45309))),
                const SizedBox(height: 4),
                Text('"$justification"',
                    style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Colors.grey[700])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Policy validation panel
  Widget _buildPolicyPanel() {
    final policy = widget.claim['policy_result'];
    if (policy == null) return const SizedBox.shrink();

    final summary = policy['summary'] as Map<String, dynamic>?;
    final checks = (policy['checks'] as List<dynamic>?)
            ?.map((c) => Map<String, dynamic>.from(c))
            .toList() ??
        [];
    final total = summary?['total'] ?? checks.length;
    final passed = summary?['passed'] ?? 0;
    final warnings = summary?['warnings'] ?? 0;
    final failures = summary?['failures'] ?? 0;

    final Color statusColor;
    final IconData statusIcon;
    if (failures > 0) {
      statusColor = const Color(0xFFDC2626);
      statusIcon = Icons.cancel;
    } else if (warnings > 0) {
      statusColor = const Color(0xFFF59E0B);
      statusIcon = Icons.warning;
    } else {
      statusColor = const Color(0xFF16A34A);
      statusIcon = Icons.check_circle;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary row
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(statusIcon, size: 16, color: statusColor),
              const SizedBox(width: 8),
              Text(
                'Policy: $passed/$total passed',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: statusColor),
              ),
              if (warnings > 0)
                Text(' · $warnings warning${warnings == 1 ? '' : 's'}',
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFFB45309))),
              if (failures > 0)
                Text(' · $failures fail${failures == 1 ? '' : 's'}',
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
              const Spacer(),
              if (checks.isNotEmpty)
                Icon(Icons.expand_more, size: 16, color: Colors.grey[400]),
            ],
          ),
        ),

        // Individual checks (show non-pass ones, or all if few)
        if (checks.isNotEmpty) ...[
          const SizedBox(height: 6),
          ...checks.map((c) {
            final severity = c['severity'] ?? 'pass';
            if (severity == 'pass' && checks.length > 3) {
              return const SizedBox.shrink();
            }
            return Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 4),
              child: Row(
                children: [
                  Icon(
                    severity == 'pass'
                        ? Icons.check_circle
                        : severity == 'warn'
                            ? Icons.warning
                            : Icons.cancel,
                    size: 14,
                    color: severity == 'pass'
                        ? const Color(0xFF16A34A)
                        : severity == 'warn'
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFFDC2626),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      c['message'] ?? c['rule_name'] ?? '',
                      style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],

        _buildExceptionBanner(),
      ],
    );
  }

  // Prior approvals (steps already approved before this one)
  Widget _buildPriorApprovals() {
    final workflow = widget.claim['workflow'];
    if (workflow == null) return const SizedBox.shrink();

    final steps = (workflow['steps'] as List<dynamic>?)
            ?.map((s) => Map<String, dynamic>.from(s))
            .toList() ??
        [];
    final currentStep = workflow['current_step'] ?? 1;
    final priorSteps =
        steps.where((s) => (s['order'] ?? 0) < currentStep && s['status'] == 'approved').toList();

    if (priorSteps.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: priorSteps.map((s) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                const Icon(Icons.check_circle,
                    size: 14, color: NucleusColors.approved),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Step ${s['order']}: Approved by ${s['approver_name']}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ),
                if (s['acted_at'] != null)
                  Text(
                    _fmtDateTime(s['acted_at']),
                    style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // Approver context — "You are reviewing as: Line Manager"
  Widget _buildApproverContext() {
    final workflow = widget.claim['workflow'];
    if (workflow == null) return const SizedBox.shrink();

    final steps = (workflow['steps'] as List<dynamic>?)
            ?.map((s) => Map<String, dynamic>.from(s))
            .toList() ??
        [];
    final currentStep = workflow['current_step'] ?? 1;
    final myStep = steps.cast<Map<String, dynamic>?>().firstWhere(
          (s) => s?['order'] == currentStep,
          orElse: () => null,
        );
    if (myStep == null) return const SizedBox.shrink();

    final roleLabel = _extractRoleLabel(myStep['resolution_path'] ?? '');

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: NucleusColors.accentTeal.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.person, size: 14, color: NucleusColors.accentTeal),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(children: [
                const TextSpan(
                    text: 'You are reviewing as: ',
                    style: TextStyle(fontSize: 12)),
                TextSpan(
                    text: roleLabel,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: NucleusColors.accentTeal)),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  // Query input
  Widget _buildQueryInput() {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 38,
              child: TextField(
                controller: _queryCtrl,
                autofocus: true,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Ask a question about this claim...',
                  hintStyle: const TextStyle(fontSize: 13),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8)),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  isDense: true,
                ),
                onSubmitted: (_) {
                  if (_queryCtrl.text.trim().isNotEmpty) {
                    _doAction('query', note: _queryCtrl.text.trim());
                  }
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 38,
            child: FilledButton(
              onPressed: _queryCtrl.text.trim().isNotEmpty
                  ? () => _doAction('query', note: _queryCtrl.text.trim())
                  : null,
              style: FilledButton.styleFrom(
                backgroundColor: NucleusColors.queried,
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
              child: const Text('Send', style: TextStyle(fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }

  // Action buttons
  Widget _buildActions() {
    if (_acting) {
      return const Center(
        child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Row(
      children: [
        // Approve — primary, one-tap
        Expanded(
          flex: 2,
          child: FilledButton.icon(
            onPressed: () => _doAction('approve'),
            icon: const Icon(Icons.check, size: 18),
            label: const Text('Approve',
                style: TextStyle(fontWeight: FontWeight.w600)),
            style: FilledButton.styleFrom(
              backgroundColor: NucleusColors.approved,
              minimumSize: const Size(0, 42),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Query — secondary
        Expanded(
          child: OutlinedButton(
            onPressed: () => setState(() => _queryMode = !_queryMode),
            style: OutlinedButton.styleFrom(
              foregroundColor: NucleusColors.queried,
              side: BorderSide(
                  color: _queryMode
                      ? NucleusColors.queried
                      : Colors.grey[300]!),
              minimumSize: const Size(0, 42),
            ),
            child: const Text('Query',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ),
        const SizedBox(width: 8),
        // Reject — requires reason
        SizedBox(
          height: 42,
          child: OutlinedButton(
            onPressed: _showRejectDialog,
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
              side: BorderSide(color: Colors.grey[300]!),
              minimumSize: const Size(0, 42),
            ),
            child: const Text('Reject',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ),
      ],
    );
  }

  // Action result card (shown briefly before animating out)
  Widget _buildActionResult() {
    final IconData icon;
    final String title;
    final String subtitle;
    final Color color;

    switch (_actionResult) {
      case 'approved':
        icon = Icons.check_circle;
        title = 'Approved';
        subtitle =
            '${widget.claim['claimant_name']}\'s claim — moving to next step';
        color = NucleusColors.approved;
      case 'queried':
        icon = Icons.help_outline;
        title = 'Query Sent';
        subtitle =
            'Sent to ${widget.claim['claimant_name']} — awaiting response';
        color = NucleusColors.queried;
      case 'rejected':
        icon = Icons.cancel;
        title = 'Rejected';
        subtitle = '${widget.claim['claimant_name']} has been notified';
        color = const Color(0xFFDC2626);
      default:
        icon = Icons.info_outline;
        title = '';
        subtitle = '';
        color = Colors.grey;
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      color: color.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: color)),
                  Text(subtitle,
                      style: TextStyle(fontSize: 12, color: Colors.grey[600])),
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
// Detail Chip
// ---------------------------------------------------------------------------

class _DetailChip extends StatelessWidget {
  final Widget icon;
  final String label;

  const _DetailChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _fmtGBP(dynamic amount) {
  final v = (amount as num?)?.toDouble() ?? 0;
  return NumberFormat.currency(locale: 'en_GB', symbol: '£').format(v);
}

String _fmtDate(dynamic d) {
  if (d == null) return '';
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(d.toString()));
  } catch (_) {
    return d.toString();
  }
}

String _fmtDateTime(dynamic d) {
  if (d == null) return '';
  try {
    return DateFormat('d MMM HH:mm').format(DateTime.parse(d.toString()));
  } catch (_) {
    return d.toString();
  }
}


String _categoryLabel(String category) {
  return category
      .replaceAll('_', ' ')
      .split(' ')
      .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
      .join(' ');
}

String _extractRoleLabel(String resolutionPath) {
  // Extract role from path like "Sarah Chen →[reports_to]→ Alex Drummond"
  final match = RegExp(r'→\[(\w+)\]→').firstMatch(resolutionPath);
  if (match != null) {
    return match.group(1)!.replaceAll('_', ' ').split(' ').map((w) {
      if (w.isEmpty) return '';
      return '${w[0].toUpperCase()}${w.substring(1)}';
    }).join(' ');
  }
  // Fallback: try to extract from "CC owner" pattern
  if (resolutionPath.contains('CC owner')) return 'Cost Centre Owner';
  if (resolutionPath.contains('reports_to')) return 'Line Manager';
  return 'Approver';
}
