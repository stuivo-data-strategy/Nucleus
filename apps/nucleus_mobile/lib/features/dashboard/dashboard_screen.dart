import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../../shared/models/user.dart';
import '../../shared/widgets/nucleus_avatar.dart';
import '../../shared/widgets/status_badge.dart';
import '../claims/new_claim_flow.dart';
import '../shell/app_shell.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;

  // Employee data
  List<Map<String, dynamic>> _recentClaims = [];
  List<Map<String, dynamic>> _queriedClaims = [];
  int _policyCount = 0;

  // Manager data
  List<Map<String, dynamic>> _pendingApprovals = [];

  // Finance data
  List<Map<String, dynamic>> _approvedClaims = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload when user changes
    final auth = context.read<AuthProvider>();
    auth.addListener(_onUserChanged);
  }

  void _onUserChanged() {
    if (mounted) _loadData();
  }

  @override
  void dispose() {
    context.read<AuthProvider>().removeListener(_onUserChanged);
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final api = context.read<ApiClient>();
    final user = context.read<AuthProvider>().currentUser;
    if (user == null) return;

    try {
      final variant = _dashboardVariant(user);

      if (variant == _Variant.finance) {
        final resp = await api.get('/expenses/approved');
        _approvedClaims =
            List<Map<String, dynamic>>.from(resp['data']?['approved'] ?? []);
      } else if (variant == _Variant.manager) {
        final resp =
            await api.get('/expenses', queryParams: {'role': 'approver'});
        _pendingApprovals =
            List<Map<String, dynamic>>.from(resp['data']?['claims'] ?? []);
      }

      // All roles fetch their own claims
      final claimsResp =
          await api.get('/expenses', queryParams: {'role': 'claimant'});
      final allClaims =
          List<Map<String, dynamic>>.from(claimsResp['data']?['claims'] ?? []);
      _recentClaims = allClaims.take(4).toList();
      _queriedClaims =
          allClaims.where((c) => c['status'] == 'queried').toList();

      // Fetch policy count
      try {
        final policyResp = await api.get('/policies/rules');
        final rules = policyResp['data'] as List<dynamic>? ?? [];
        _policyCount = rules.length;
      } catch (_) {
        _policyCount = 0;
      }

      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Unable to connect to Nucleus API';
        });
      }
    }
  }

  _Variant _dashboardVariant(NucleusUser user) {
    if (user.isFinanceApprover) return _Variant.finance;
    if (user.roles.contains('line_manager') ||
        user.roles.contains('manager') ||
        user.roles.contains('senior_manager')) {
      return _Variant.manager;
    }
    return _Variant.employee;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    if (user == null) return const SizedBox.shrink();

    if (_error != null) {
      return _ErrorView(error: _error!, onRetry: _loadData);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > kMobileBreakpoint;
        final variant = _dashboardVariant(user);

        return RefreshIndicator(
          onRefresh: _loadData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.all(isDesktop ? 32 : 16),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _GreetingHeader(user: user),
                    const SizedBox(height: 24),
                    if (_loading)
                      const _DashboardSkeleton()
                    else ...[
                      // Role-specific primary card
                      if (variant == _Variant.employee &&
                          _queriedClaims.isNotEmpty)
                        _QueriedClaimsCard(claims: _queriedClaims),
                      if (variant == _Variant.manager)
                        _PendingApprovalsCard(claims: _pendingApprovals),
                      if (variant == _Variant.finance)
                        _FinanceProcessingCard(claims: _approvedClaims),

                      const SizedBox(height: 20),

                      // Quick actions
                      _QuickActionsGrid(
                        variant: variant,
                        isDesktop: isDesktop,
                        pendingCount: _pendingApprovals.length,
                        financeCount: _approvedClaims.length,
                      ),

                      const SizedBox(height: 24),

                      // Recent claims (all roles)
                      _RecentClaimsSection(claims: _recentClaims),

                      // Policy note (employee only)
                      if (variant == _Variant.employee && _policyCount > 0) ...[
                        const SizedBox(height: 20),
                        _PolicyNote(count: _policyCount),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

enum _Variant { employee, manager, finance }

// ---------------------------------------------------------------------------
// Greeting Header
// ---------------------------------------------------------------------------

class _GreetingHeader extends StatelessWidget {
  final NucleusUser user;
  const _GreetingHeader({required this.user});

  String get _greeting {
    final h = DateTime.now().hour;
    final time = h < 12
        ? 'morning'
        : h < 17
            ? 'afternoon'
            : 'evening';
    return 'Good $time, ${user.firstName}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _greeting,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: NucleusColors.primaryNavy,
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
            if (user.roles.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: NucleusColors.accentTeal.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  user.roles.first.replaceAll('_', ' '),
                  style: const TextStyle(
                    color: NucleusColors.accentTeal,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Role-specific Primary Cards
// ---------------------------------------------------------------------------

class _QueriedClaimsCard extends StatelessWidget {
  final List<Map<String, dynamic>> claims;
  const _QueriedClaimsCard({required this.claims});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF7C3AED), Color(0xFF8B5CF6)],
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.reply, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Response Required — ${claims.length} ${claims.length == 1 ? 'query' : 'queries'}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
          ...claims.map((c) => ListTile(
                leading: const Icon(Icons.help,
                    color: Color(0xFF7C3AED)),
                title: Text(c['reference'] ?? '',
                    style: NucleusTheme.mono.copyWith(fontSize: 13)),
                subtitle: const Text('Awaiting your response'),
                trailing: Text(
                  _formatGBP(c['amount']),
                  style: NucleusTheme.monoAmount(fontSize: 14),
                ),
              )),
        ],
      ),
    );
  }
}

class _PendingApprovalsCard extends StatelessWidget {
  final List<Map<String, dynamic>> claims;
  const _PendingApprovalsCard({required this.claims});

  @override
  Widget build(BuildContext context) {
    final total = claims.fold<double>(
        0, (sum, c) => sum + ((c['amount'] as num?)?.toDouble() ?? 0));

    return GestureDetector(
      onTap: () => AppShell.of(context)?.navigateTo(2),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFF59E0B), Color(0xFFFBBF24)],
            ),
          ),
          child: claims.isEmpty
              ? const Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.white, size: 28),
                  SizedBox(width: 12),
                  Text(
                    'All caught up — no pending approvals',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${claims.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '${claims.length} ${claims.length == 1 ? 'claim' : 'claims'} totalling ${_formatGBP(total)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Review Approvals →',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
        ),
      ),
    );
  }
}

class _FinanceProcessingCard extends StatelessWidget {
  final List<Map<String, dynamic>> claims;
  const _FinanceProcessingCard({required this.claims});

  @override
  Widget build(BuildContext context) {
    final total = claims.fold<double>(
        0, (sum, c) => sum + ((c['amount'] as num?)?.toDouble() ?? 0));

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
          ),
        ),
        child: claims.isEmpty
            ? const Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.white, size: 28),
                  SizedBox(width: 12),
                  Text(
                    'No claims ready for export',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 16),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${claims.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '${claims.length} approved ${claims.length == 1 ? 'claim' : 'claims'} totalling ${_formatGBP(total)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Open Finance Export →',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick Actions Grid
// ---------------------------------------------------------------------------

class _QuickActionsGrid extends StatelessWidget {
  final _Variant variant;
  final bool isDesktop;
  final int pendingCount;
  final int financeCount;

  const _QuickActionsGrid({
    required this.variant,
    required this.isDesktop,
    required this.pendingCount,
    required this.financeCount,
  });

  @override
  Widget build(BuildContext context) {
    final actions = _actionsForVariant(context);
    return GridView.count(
      crossAxisCount: isDesktop ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: isDesktop ? 2.5 : 1.4,
      children: actions,
    );
  }

  List<Widget> _actionsForVariant(BuildContext context) {
    switch (variant) {
      case _Variant.employee:
        return [
          _QuickActionCard(
            icon: Icons.photo_camera,
            label: 'New Expense',
            onTap: () => NewClaimFlow.show(context),
          ),
          _QuickActionCard(
            icon: Icons.beach_access,
            label: 'Request Leave',
            onTap: () => _toast(context, 'Leave management coming in Phase 2'),
          ),
          _QuickActionCard(
            icon: Icons.timer,
            label: 'Log Time',
            onTap: () => _toast(context, 'Timesheets coming in Phase 2'),
          ),
          _QuickActionCard(
            icon: Icons.adjust,
            label: 'Update Goals',
            onTap: () => _toast(context, 'Performance goals coming in Phase 2'),
          ),
        ];
      case _Variant.manager:
        return [
          _QuickActionCard(
            icon: Icons.task_alt,
            label: 'Approvals',
            badge: pendingCount,
            onTap: () => AppShell.of(context)?.navigateTo(2),
          ),
          _QuickActionCard(
            icon: Icons.photo_camera,
            label: 'New Expense',
            onTap: () => NewClaimFlow.show(context),
          ),
          _QuickActionCard(
            icon: Icons.group,
            label: 'My Team',
            onTap: () => _toast(context, 'Team insights coming in Phase 2'),
          ),
          _QuickActionCard(
            icon: Icons.bar_chart,
            label: 'Reports',
            onTap: () => _toast(context, 'Spend reports coming in Phase 2'),
          ),
        ];
      case _Variant.finance:
        return [
          _QuickActionCard(
            icon: Icons.upload,
            label: 'Finance Export',
            badge: financeCount,
            onTap: () => _toast(context, 'Navigate to Finance tab'),
          ),
          _QuickActionCard(
            icon: Icons.shield,
            label: 'Policy Rules',
            onTap: () => _toast(context, 'Navigate to Policy Rules tab'),
          ),
          _QuickActionCard(
            icon: Icons.photo_camera,
            label: 'New Expense',
            onTap: () => NewClaimFlow.show(context),
          ),
          _QuickActionCard(
            icon: Icons.bar_chart,
            label: 'Spend Report',
            onTap: () =>
                _toast(context, 'Spend analytics coming in Phase 2'),
          ),
        ];
    }
  }

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
        backgroundColor: NucleusColors.primaryNavy,
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final int badge;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 28, color: NucleusColors.accentTeal),
                  if (badge > 0)
                    Positioned(
                      right: -8,
                      top: -4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: NucleusColors.accentTeal,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$badge',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: NucleusColors.primaryNavy,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Recent Claims
// ---------------------------------------------------------------------------

class _RecentClaimsSection extends StatelessWidget {
  final List<Map<String, dynamic>> claims;
  const _RecentClaimsSection({required this.claims});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Claims',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.primaryNavy,
                  ),
            ),
            if (claims.isNotEmpty)
              TextButton(
                onPressed: () {},
                child: const Text('View all →'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (claims.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.receipt_long, size: 36, color: NucleusColors.accentTeal),
                    const SizedBox(height: 8),
                    Text(
                      'No expenses yet',
                      style: TextStyle(color: Colors.grey[500]),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...claims.map((c) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: _categoryIcon(c['category'] ?? ''),
                  title: Text(
                    c['description'] ?? c['category'] ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Row(
                    children: [
                      Text(
                        c['reference'] ?? '',
                        style: NucleusTheme.mono
                            .copyWith(fontSize: 11, color: Colors.grey[500]),
                      ),
                      const SizedBox(width: 8),
                      StatusBadge(status: c['status'] ?? ''),
                    ],
                  ),
                  trailing: Text(
                    _formatGBP(c['amount']),
                    style: NucleusTheme.monoAmount(
                      fontSize: 15,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                ),
              )),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Policy Note
// ---------------------------------------------------------------------------

class _PolicyNote extends StatelessWidget {
  final int count;
  const _PolicyNote({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NucleusColors.accentTeal.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: NucleusColors.accentTeal.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user, color: NucleusColors.accentTeal),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Your claims are validated against $count active policy rules on every submission',
              style: const TextStyle(
                color: NucleusColors.accentTeal,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Column(
        children: [
          // Primary card skeleton
          Container(
            height: 100,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 20),
          // Quick actions skeleton
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.6,
            children: List.generate(
              4,
              (_) => Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Claims skeleton
          ...List.generate(
            3,
            (_) => Container(
              height: 72,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error View
// ---------------------------------------------------------------------------

class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Card(
        margin: const EdgeInsets.all(32),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off, size: 48, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                error,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _formatGBP(dynamic amount) {
  final value = (amount is num) ? amount.toDouble() : 0.0;
  return NumberFormat.currency(locale: 'en_GB', symbol: '£').format(value);
}

Widget _categoryIcon(String category) {
  final icons = {
    'travel': Icons.flight,
    'meals': Icons.restaurant,
    'accommodation': Icons.hotel,
    'office_supplies': Icons.inventory_2,
    'client_entertainment': Icons.celebration,
    'training': Icons.school,
    'equipment': Icons.devices,
    'mileage': Icons.directions_car,
  };
  return CircleAvatar(
    backgroundColor: NucleusColors.accentTeal.withValues(alpha: 0.1),
    child: Icon(
      icons[category.toLowerCase()] ?? Icons.receipt,
      color: NucleusColors.accentTeal,
      size: 20,
    ),
  );
}
