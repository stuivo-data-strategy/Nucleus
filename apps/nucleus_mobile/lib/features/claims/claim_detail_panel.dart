import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../shared/widgets/nucleus_avatar.dart';
import '../../shared/widgets/status_badge.dart';
import 'new_claim_flow.dart';

class ClaimDetailPanel extends StatefulWidget {
  final String claimId;
  final VoidCallback? onClose;

  const ClaimDetailPanel({
    super.key,
    required this.claimId,
    this.onClose,
  });

  @override
  State<ClaimDetailPanel> createState() => _ClaimDetailPanelState();
}

class _ClaimDetailPanelState extends State<ClaimDetailPanel> {
  bool _loading = true;
  Map<String, dynamic>? _claim;
  Map<String, dynamic>? _timeline;
  List<dynamic> _policyAudit = [];
  bool _resolutionExpanded = false;
  bool _policyExpanded = false;
  final _responseController = TextEditingController();
  bool _responding = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  @override
  void didUpdateWidget(ClaimDetailPanel old) {
    super.didUpdateWidget(old);
    if (old.claimId != widget.claimId) _loadDetail();
  }

  Future<void> _loadDetail() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final resp = await api.get('/expenses/${widget.claimId}');
      final data = resp['data'] ?? {};
      setState(() {
        _claim = Map<String, dynamic>.from(data['claim'] ?? data);
        _timeline = data['timeline'] != null
            ? Map<String, dynamic>.from(data['timeline'])
            : null;
        _policyAudit = data['policy_audit'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _respondToQuery() async {
    final text = _responseController.text.trim();
    if (text.isEmpty) return;
    setState(() => _responding = true);
    try {
      final api = context.read<ApiClient>();
      await api.post('/expenses/${widget.claimId}/action', body: {
        'action': 'respond',
        'note': text,
      });
      _responseController.clear();
      await _loadDetail();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send response')),
        );
      }
    }
    if (mounted) setState(() => _responding = false);
  }

  @override
  void dispose() {
    _responseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_claim == null) {
      return const Center(child: Text('Claim not found'));
    }

    final claim = _claim!;
    final workflow = claim['workflow'] as Map<String, dynamic>?;
    final steps = (workflow?['steps'] as List<dynamic>?)
            ?.map((s) => Map<String, dynamic>.from(s))
            .toList() ??
        [];
    final isQueried = claim['status'] == 'queried';

    return Column(
      children: [
        // Header bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
          ),
          child: Row(
            children: [
              if (widget.onClose != null)
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: widget.onClose,
                  visualDensity: VisualDensity.compact,
                ),
              Expanded(
                child: Text(
                  claim['reference'] ?? 'Claim Detail',
                  style: NucleusTheme.mono.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: NucleusColors.primaryNavy,
                  ),
                ),
              ),
              StatusBadge(status: claim['status'] ?? '', fontSize: 12),
            ],
          ),
        ),

        // Scrollable content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Amount header
                _AmountHeader(claim: claim),
                const SizedBox(height: 20),

                // Claim info
                _InfoSection(claim: claim),
                const SizedBox(height: 20),

                // Query response section
                if (isQueried) ...[
                  _QuerySection(
                    steps: steps,
                    controller: _responseController,
                    responding: _responding,
                    onSend: _respondToQuery,
                  ),
                  const SizedBox(height: 20),
                ],

                // Policy validation results
                _PolicySection(
                  claim: claim,
                  policyAudit: _policyAudit,
                  expanded: _policyExpanded,
                  onToggle: () =>
                      setState(() => _policyExpanded = !_policyExpanded),
                ),
                const SizedBox(height: 20),

                // Workflow steps
                if (steps.isNotEmpty) ...[
                  _WorkflowSection(steps: steps),
                  const SizedBox(height: 20),
                ],

                // Resolution path
                _ResolutionSection(
                  workflow: workflow,
                  timeline: _timeline,
                  expanded: _resolutionExpanded,
                  onToggle: () => setState(
                      () => _resolutionExpanded = !_resolutionExpanded),
                ),
                const SizedBox(height: 20),

                // Activity timeline
                _ActivityTimeline(
                  claim: claim,
                  timeline: _timeline,
                  policyAudit: _policyAudit,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Amount Header
// ---------------------------------------------------------------------------

class _AmountHeader extends StatelessWidget {
  final Map<String, dynamic> claim;
  const _AmountHeader({required this.claim});

  @override
  Widget build(BuildContext context) {
    final amount = (claim['amount'] as num?)?.toDouble() ?? 0;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: NucleusColors.accentTeal.withValues(alpha: 0.1),
          child: Icon(
            categoryIcon(claim['category'] ?? ''),
            size: 22,
            color: NucleusColors.accentTeal,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                claim['description'] ?? claim['category'] ?? '',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.primaryNavy,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                _fmtGBP(amount),
                style: NucleusTheme.monoAmount(
                  fontSize: 28,
                  color: NucleusColors.primaryNavy,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Info Section
// ---------------------------------------------------------------------------

class _InfoSection extends StatelessWidget {
  final Map<String, dynamic> claim;
  const _InfoSection({required this.claim});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _infoRow('Category', _categoryLabel(claim['category'] ?? '')),
            _infoRow('Date', _fmtDate(claim['date'])),
            _infoRow('Currency', claim['currency'] ?? 'GBP'),
            _infoRow('Receipt', (claim['has_receipt'] == true) ? 'Yes' : 'No'),
            if (claim['claimant_name'] != null)
              _infoRow('Claimant', claim['claimant_name']),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.w500, fontSize: 13)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Query Section
// ---------------------------------------------------------------------------

class _QuerySection extends StatelessWidget {
  final List<Map<String, dynamic>> steps;
  final TextEditingController controller;
  final bool responding;
  final VoidCallback onSend;

  const _QuerySection({
    required this.steps,
    required this.controller,
    required this.responding,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final queriedStep = steps.cast<Map<String, dynamic>?>().firstWhere(
          (s) => s?['status'] == 'queried',
          orElse: () => null,
        );
    final approverName = queriedStep?['approver_name'] ?? 'Approver';
    final queryNote = queriedStep?['note'] ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NucleusColors.queried.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: NucleusColors.queried.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.help_outline, size: 18, color: NucleusColors.queried),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$approverName has a question',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: NucleusColors.queried,
                  ),
                ),
              ),
            ],
          ),
          if (queryNote.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '"$queryNote"',
              style: TextStyle(
                fontStyle: FontStyle.italic,
                color: Colors.grey[700],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    hintText: 'Type your response…',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                  onSubmitted: (_) => onSend(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: responding ? null : onSend,
                icon: responding
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send, size: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Policy Section
// ---------------------------------------------------------------------------

class _PolicySection extends StatelessWidget {
  final Map<String, dynamic> claim;
  final List<dynamic> policyAudit;
  final bool expanded;
  final VoidCallback onToggle;

  const _PolicySection({
    required this.claim,
    required this.policyAudit,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    // Try policy_result from claim, then from audit entries
    final policyResult = claim['policy_result'] as Map<String, dynamic>?;
    final approvalResult =
        claim['policy_result_approval'] as Map<String, dynamic>?;

    if (policyResult == null && policyAudit.isEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.policy,
                      color: NucleusColors.accentTeal, size: 20),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Policy Checks',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                  ),
                  if (policyResult != null) _summaryBadge(policyResult),
                  const SizedBox(width: 8),
                  Icon(
                    expanded ? Icons.expand_less : Icons.expand_more,
                    color: Colors.grey[500],
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            const Divider(height: 1),
            if (policyResult != null)
              _PolicyChecks(
                  label: 'At Submission', result: policyResult),
            if (approvalResult != null)
              _PolicyChecks(
                  label: 'At Approval Review', result: approvalResult),
            for (final audit in policyAudit)
              if (audit is Map<String, dynamic> &&
                  audit['result'] is Map<String, dynamic>)
                _PolicyChecks(
                  label:
                      'At ${_evalPointLabel(audit['evaluation_point'] ?? '')}',
                  result: audit['result'],
                ),
          ],
        ],
      ),
    );
  }

  Widget _summaryBadge(Map<String, dynamic> result) {
    final summary = result['summary'] as Map<String, dynamic>?;
    if (summary == null) return const SizedBox.shrink();
    final passed = summary['passed'] ?? 0;
    final total = summary['total'] ?? 0;
    final allPassed = passed == total;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: allPassed
            ? NucleusColors.approved.withValues(alpha: 0.1)
            : NucleusColors.rejected.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$passed/$total passed',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: allPassed ? NucleusColors.approved : NucleusColors.rejected,
        ),
      ),
    );
  }

  String _evalPointLabel(String point) {
    return switch (point) {
      'submission' => 'Submission',
      'approval_review' => 'Approval Review',
      'capture' => 'Capture',
      'admin_change' => 'Admin Change',
      _ => point,
    };
  }
}

class _PolicyChecks extends StatelessWidget {
  final String label;
  final Map<String, dynamic> result;

  const _PolicyChecks({required this.label, required this.result});

  @override
  Widget build(BuildContext context) {
    final checks = (result['checks'] as List<dynamic>?) ?? [];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.grey[500],
            ),
          ),
          const SizedBox(height: 6),
          ...checks.map((c) {
            final check = Map<String, dynamic>.from(c);
            final severity = check['severity'] ?? 'pass';
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _severityIcon(severity),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      check['message'] ?? check['rule_name'] ?? '',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _severityIcon(String severity) {
    return switch (severity) {
      'pass' => const Icon(Icons.check_circle, color: NucleusColors.approved, size: 18),
      'warn' => const Icon(Icons.warning, color: NucleusColors.warning, size: 18),
      'fail' => const Icon(Icons.cancel, color: NucleusColors.rejected, size: 18),
      _ => const Icon(Icons.help, color: Colors.grey, size: 18),
    };
  }
}

// ---------------------------------------------------------------------------
// Workflow Steps
// ---------------------------------------------------------------------------

class _WorkflowSection extends StatelessWidget {
  final List<Map<String, dynamic>> steps;
  const _WorkflowSection({required this.steps});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Approval Workflow',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: NucleusColors.primaryNavy,
              ),
            ),
            const SizedBox(height: 12),
            ...steps.asMap().entries.map((e) {
              final idx = e.key;
              final step = e.value;
              final isLast = idx == steps.length - 1;
              return _WorkflowStepTile(step: step, isLast: isLast);
            }),
          ],
        ),
      ),
    );
  }
}

class _WorkflowStepTile extends StatelessWidget {
  final Map<String, dynamic> step;
  final bool isLast;

  const _WorkflowStepTile({required this.step, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final status = step['status'] ?? '';
    final name = step['approver_name'] ?? '';
    final role = step['resolution_path'] ?? '';
    final actedAt = step['acted_at'];
    final note = step['note'];

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline indicator
          Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: _statusColor(status),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: _statusIcon(status),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: _statusColor(status).withValues(alpha: 0.3),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      if (role.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: NucleusColors.accentTeal
                                .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            role,
                            style: const TextStyle(
                              fontSize: 10,
                              color: NucleusColors.accentTeal,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    actedAt != null
                        ? '${_statusLabel(status)} — ${_fmtDateTime(actedAt)}'
                        : '⏳ ${_statusLabel(status)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                  ),
                  if (note != null && note.toString().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Text(
                        note.toString(),
                        style: TextStyle(
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                          color: Colors.grey[700],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    return switch (status) {
      'approved' => NucleusColors.approved,
      'rejected' => NucleusColors.rejected,
      'queried' => NucleusColors.queried,
      'pending' => NucleusColors.accentTeal,
      _ => Colors.grey[300]!,
    };
  }

  Widget _statusIcon(String status) {
    const style =
        TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold);
    return switch (status) {
      'approved' => const Text('✓', style: style),
      'rejected' => const Text('✗', style: style),
      'queried' => const Text('?', style: style),
      'pending' => const Text('…', style: style),
      _ => const Text('…', style: style),
    };
  }

  String _statusLabel(String status) {
    return switch (status) {
      'approved' => 'Approved',
      'rejected' => 'Rejected',
      'queried' => 'Queried',
      'pending' => 'Pending',
      'waiting' => 'Waiting',
      _ => status,
    };
  }
}

// ---------------------------------------------------------------------------
// Resolution Path
// ---------------------------------------------------------------------------

class _ResolutionSection extends StatelessWidget {
  final Map<String, dynamic>? workflow;
  final Map<String, dynamic>? timeline;
  final bool expanded;
  final VoidCallback onToggle;

  const _ResolutionSection({
    required this.workflow,
    required this.timeline,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final log = _getResolutionLog();
    if (log.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.route,
                      color: NucleusColors.accentTeal, size: 20),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'How Were Approvers Determined?',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                  ),
                  Text(
                    expanded ? 'Hide' : 'Show',
                    style: const TextStyle(
                        fontSize: 12, color: NucleusColors.accentTeal),
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            const Divider(height: 1),
            Container(
              width: double.infinity,
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: NucleusColors.primaryNavy.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: log.map((line) {
                  if (line == '---') {
                    return const Divider(height: 16);
                  }
                  final isTeal = line.startsWith('  ');
                  final isBold = line.startsWith('Final');
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      line,
                      style: NucleusTheme.mono.copyWith(
                        fontSize: 11,
                        color: isTeal
                            ? NucleusColors.accentTeal
                            : isBold
                                ? NucleusColors.primaryNavy
                                : Colors.grey[600],
                        fontWeight:
                            isBold ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<String> _getResolutionLog() {
    final fromTimeline =
        timeline?['instance']?['resolution_log'] ?? timeline?['resolution_log'];
    final fromWorkflow = workflow?['resolution_log'];
    final raw = fromTimeline ?? fromWorkflow;
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return [];
  }
}

// ---------------------------------------------------------------------------
// Activity Timeline
// ---------------------------------------------------------------------------

class _ActivityTimeline extends StatelessWidget {
  final Map<String, dynamic> claim;
  final Map<String, dynamic>? timeline;
  final List<dynamic> policyAudit;

  const _ActivityTimeline({
    required this.claim,
    required this.timeline,
    required this.policyAudit,
  });

  @override
  Widget build(BuildContext context) {
    final entries = _buildEntries();
    if (entries.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Activity Timeline',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: NucleusColors.primaryNavy,
              ),
            ),
            const SizedBox(height: 12),
            ...entries.asMap().entries.map((e) {
              final idx = e.key;
              final entry = e.value;
              return _TimelineEntry(
                entry: entry,
                isLast: idx == entries.length - 1,
              );
            }),
          ],
        ),
      ),
    );
  }

  List<_TimelineItem> _buildEntries() {
    final items = <_TimelineItem>[];

    // Submission
    if (claim['created_at'] != null) {
      items.add(_TimelineItem(
        icon: Icons.assignment,
        title: 'Submitted by ${claim['claimant_name'] ?? 'Claimant'}',
        timestamp: claim['created_at'],
        color: Colors.grey[100]!,
      ));
    }

    // Policy audit entries
    for (final audit in policyAudit) {
      if (audit is! Map<String, dynamic>) continue;
      final result = audit['result'] as Map<String, dynamic>?;
      final summary = result?['summary'] as Map<String, dynamic>?;
      final passed = summary?['passed'] ?? 0;
      final total = summary?['total'] ?? 0;
      final point = audit['evaluation_point'] ?? '';

      items.add(_TimelineItem(
        icon: Icons.policy,
        title: point == 'submission'
            ? 'Policy validated: $passed/$total checks passed'
            : 'Policy re-validated at approval: $passed/$total checks passed',
        timestamp: audit['created_at'],
        color: const Color(0xFFEFF6FF),
      ));
    }

    // Workflow actions from timeline
    final actions = timeline?['actions'] as List<dynamic>? ?? [];
    for (final a in actions) {
      if (a is! Map<String, dynamic>) continue;
      final action = a['action'] ?? '';
      items.add(_TimelineItem(
        icon: _actionIcon(action),
        title: _actionTitle(action, a),
        note: a['note']?.toString(),
        timestamp: a['created_at'],
        color: _actionColor(action),
      ));
    }

    // Sort by timestamp
    items.sort((a, b) {
      final ta = a.timestamp ?? '';
      final tb = b.timestamp ?? '';
      return ta.compareTo(tb);
    });

    return items;
  }

  IconData _actionIcon(String action) {
    return switch (action) {
      'approve' => Icons.check_circle,
      'reject' => Icons.cancel,
      'query' => Icons.help_outline,
      'respond' => Icons.chat_bubble_outline,
      'created' => Icons.alt_route,
      _ => Icons.push_pin,
    };
  }

  String _actionTitle(String action, Map<String, dynamic> data) {
    final actor = data['actor_name'] ?? data['actor'] ?? '';
    return switch (action) {
      'approve' => 'Approved by $actor',
      'reject' => 'Rejected by $actor',
      'query' => 'Queried by $actor',
      'respond' => 'Response from $actor',
      'created' => 'Workflow created',
      _ => action,
    };
  }

  Color _actionColor(String action) {
    return switch (action) {
      'approve' => const Color(0xFFF0FDF4),
      'reject' => const Color(0xFFFEF2F2),
      'query' => const Color(0xFFFAF5FF),
      'respond' => const Color(0xFFEFF6FF),
      _ => Colors.grey[50]!,
    };
  }
}

class _TimelineItem {
  final IconData icon;
  final String title;
  final String? note;
  final String? timestamp;
  final Color color;

  _TimelineItem({
    required this.icon,
    required this.title,
    this.note,
    this.timestamp,
    required this.color,
  });
}

class _TimelineEntry extends StatelessWidget {
  final _TimelineItem entry;
  final bool isLast;

  const _TimelineEntry({required this.entry, required this.isLast});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: entry.color,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Icon(entry.icon, size: 16, color: NucleusColors.primaryNavy),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: Colors.grey[200]),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.title,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  if (entry.note != null && entry.note!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      entry.note!,
                      style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                  if (entry.timestamp != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      _fmtDateTime(entry.timestamp!),
                      style:
                          TextStyle(fontSize: 11, color: Colors.grey[400]),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _fmtGBP(double amount) {
  return NumberFormat.currency(locale: 'en_GB', symbol: '£').format(amount);
}

String _fmtDate(dynamic d) {
  if (d == null) return '';
  try {
    final dt = DateTime.parse(d.toString());
    return DateFormat('d MMM yyyy').format(dt);
  } catch (_) {
    return d.toString();
  }
}

String _fmtDateTime(dynamic d) {
  if (d == null) return '';
  try {
    final dt = DateTime.parse(d.toString());
    return DateFormat('d MMM HH:mm').format(dt);
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
