import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import '../../shared/widgets/workflow_tracker.dart';
import 'claim_detail_panel.dart';
import 'new_claim_flow.dart';

class ClaimsScreen extends StatefulWidget {
  const ClaimsScreen({super.key});

  @override
  State<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends State<ClaimsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _claims = [];
  String? _selectedId;
  double _totalThisMonth = 0;
  double _totalPending = 0;

  // Query response state
  final Map<String, TextEditingController> _queryControllers = {};
  final Set<String> _respondingIds = {};

  @override
  void initState() {
    super.initState();
    _loadClaims();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    context.read<AuthProvider>().addListener(_onUserChanged);
  }

  void _onUserChanged() {
    if (mounted) {
      _selectedId = null;
      _loadClaims();
    }
  }

  @override
  void dispose() {
    context.read<AuthProvider>().removeListener(_onUserChanged);
    for (final c in _queryControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadClaims() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final resp =
          await api.get('/expenses', queryParams: {'role': 'claimant'});
      final claims =
          List<Map<String, dynamic>>.from(resp['data']?['claims'] ?? []);

      final now = DateTime.now();
      _totalThisMonth = claims
          .where((c) {
            try {
              final d = DateTime.parse(c['created_at'] ?? '');
              return d.year == now.year && d.month == now.month;
            } catch (_) {
              return false;
            }
          })
          .fold(0.0, (s, c) => s + ((c['amount'] as num?)?.toDouble() ?? 0));

      _totalPending = claims
          .where((c) =>
              c['status'] == 'pending' ||
              c['status'] == 'submitted' ||
              c['status'] == 'in_progress')
          .fold(0.0, (s, c) => s + ((c['amount'] as num?)?.toDouble() ?? 0));

      setState(() {
        _claims = claims;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _respondToQuery(String claimId) async {
    final ctrl = _queryControllers[claimId];
    final text = ctrl?.text.trim() ?? '';
    if (text.isEmpty) return;

    setState(() => _respondingIds.add(claimId));
    try {
      final api = context.read<ApiClient>();
      await api.post('/expenses/$claimId/action', body: {
        'action': 'respond',
        'note': text,
      });
      ctrl?.clear();
      await _loadClaims();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send response')),
        );
      }
    }
    if (mounted) setState(() => _respondingIds.remove(claimId));
  }

  Future<void> _openNewClaim() async {
    final submitted = await NewClaimFlow.show(context);
    if (submitted == true) _loadClaims();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > kMobileBreakpoint;

        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: FloatingActionButton(
            onPressed: _openNewClaim,
            child: const Icon(Icons.add),
          ),
          body: isDesktop ? Row(
            children: [
              // List panel
              SizedBox(
                width: 480,
                child: _buildListPanel(isDesktop: true),
              ),
              VerticalDivider(width: 1, color: Colors.grey[200]),
              // Detail panel
              Expanded(
                child: _selectedId != null
                    ? ClaimDetailPanel(
                        key: ValueKey(_selectedId),
                        claimId: _selectedId!,
                        onClose: () => setState(() => _selectedId = null),
                      )
                    : Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.receipt_long,
                                size: 48, color: Colors.grey[300]),
                            const SizedBox(height: 12),
                            Text(
                              'Select a claim to view details',
                              style: TextStyle(color: Colors.grey[400]),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ) : _buildListPanel(isDesktop: false),
        );
      },
    );
  }

  Widget _buildListPanel({required bool isDesktop}) {
    return RefreshIndicator(
      onRefresh: _loadClaims,
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
                      label: 'This Month',
                      amount: _totalThisMonth,
                      icon: Icons.calendar_month,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SummaryCard(
                      label: 'Pending Approval',
                      amount: _totalPending,
                      icon: Icons.hourglass_empty,
                    ),
                  ),
                ],
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
                    const Icon(Icons.receipt_long, size: 48, color: NucleusColors.accentTeal),
                    const SizedBox(height: 12),
                    Text('No expenses yet',
                        style: TextStyle(color: Colors.grey[500])),
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final claim = _claims[index];
                  return _ClaimCard(
                    claim: claim,
                    isSelected: _selectedId == claim['id'],
                    queryController: _getQueryController(claim['id']),
                    isResponding: _respondingIds.contains(claim['id']),
                    onTap: () {
                      if (LayoutBuilder == null) return;
                      final width = MediaQuery.of(context).size.width;
                      if (width > kMobileBreakpoint) {
                        setState(() => _selectedId = claim['id']);
                      } else {
                        // Mobile: push full-screen detail
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => Scaffold(
                              appBar: AppBar(
                                title: Text(claim['reference'] ?? 'Claim'),
                              ),
                              body: ClaimDetailPanel(
                                claimId: claim['id'],
                              ),
                            ),
                          ),
                        );
                      }
                    },
                    onRespond: () => _respondToQuery(claim['id']),
                  );
                },
                childCount: _claims.length,
              ),
            ),
        ],
      ),
    );
  }

  TextEditingController _getQueryController(String claimId) {
    return _queryControllers.putIfAbsent(
        claimId, () => TextEditingController());
  }
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

class _SummaryCard extends StatelessWidget {
  final String label;
  final double amount;
  final IconData icon;

  const _SummaryCard({
    required this.label,
    required this.amount,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: Colors.grey[500]),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              NumberFormat.currency(locale: 'en_GB', symbol: '£').format(amount),
              style: NucleusTheme.monoAmount(
                fontSize: 20,
                color: NucleusColors.primaryNavy,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Claim Card
// ---------------------------------------------------------------------------

class _ClaimCard extends StatelessWidget {
  final Map<String, dynamic> claim;
  final bool isSelected;
  final TextEditingController queryController;
  final bool isResponding;
  final VoidCallback onTap;
  final VoidCallback onRespond;

  const _ClaimCard({
    required this.claim,
    required this.isSelected,
    required this.queryController,
    required this.isResponding,
    required this.onTap,
    required this.onRespond,
  });

  @override
  Widget build(BuildContext context) {
    final category = claim['category'] ?? '';
    final amount = (claim['amount'] as num?)?.toDouble() ?? 0;
    final status = claim['status'] ?? '';
    final isQueried = status == 'queried';
    final workflowSteps =
        (claim['workflow']?['steps'] as List<dynamic>?)
            ?.map((s) => Map<String, dynamic>.from(s))
            .toList() ??
        [];

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      color: isSelected
          ? NucleusColors.accentTeal.withValues(alpha: 0.05)
          : null,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: emoji + description + amount + status
              Row(
                children: [
                  Icon(categoryIcon(category), size: 22, color: NucleusColors.accentTeal),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      claim['description'] ?? _categoryLabel(category),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    NumberFormat.currency(locale: 'en_GB', symbol: '£')
                        .format(amount),
                    style: NucleusTheme.monoAmount(
                      fontSize: 15,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 6),

              // Metadata row: date · reference · status badge
              Row(
                children: [
                  Text(
                    _fmtDate(claim['date']),
                    style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    claim['reference'] ?? '',
                    style: NucleusTheme.mono.copyWith(
                      fontSize: 11,
                      color: Colors.grey[400],
                    ),
                  ),
                  const Spacer(),
                  StatusBadge(status: status),
                ],
              ),

              // Workflow tracker
              if (workflowSteps.isNotEmpty) ...[
                const SizedBox(height: 8),
                WorkflowTracker(steps: workflowSteps),
              ],

              // Query callout
              if (isQueried) ...[
                const SizedBox(height: 10),
                _InlineQueryResponse(
                  claim: claim,
                  workflowSteps: workflowSteps,
                  controller: queryController,
                  isResponding: isResponding,
                  onSend: onRespond,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Inline Query Response
// ---------------------------------------------------------------------------

class _InlineQueryResponse extends StatelessWidget {
  final Map<String, dynamic> claim;
  final List<Map<String, dynamic>> workflowSteps;
  final TextEditingController controller;
  final bool isResponding;
  final VoidCallback onSend;

  const _InlineQueryResponse({
    required this.claim,
    required this.workflowSteps,
    required this.controller,
    required this.isResponding,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final queriedStep = workflowSteps.cast<Map<String, dynamic>?>().firstWhere(
          (s) => s?['status'] == 'queried',
          orElse: () => null,
        );
    final approverName = queriedStep?['approver_name'] ?? 'Approver';
    final note = queriedStep?['note'] ?? '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NucleusColors.queried.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: NucleusColors.queried.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$approverName has a question',
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: NucleusColors.queried,
            ),
          ),
          if (note.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '"$note"',
              style: TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: Colors.grey[700],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 36,
                  child: TextField(
                    controller: controller,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Type your response…',
                      hintStyle: const TextStyle(fontSize: 13),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                      isDense: true,
                    ),
                    onSubmitted: (_) => onSend(),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                height: 36,
                width: 36,
                child: IconButton.filled(
                  onPressed: isResponding ? null : onSend,
                  icon: isResponding
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send, size: 16),
                  padding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _fmtDate(dynamic d) {
  if (d == null) return '';
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(d.toString()));
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
