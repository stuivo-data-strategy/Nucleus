import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../../shared/models/user.dart';
import '../../shared/widgets/nucleus_avatar.dart';
import '../../shared/widgets/user_switcher.dart';
import '../approvals/approvals_screen.dart';
import '../claims/claims_screen.dart';
import '../audit/audit_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../finance/finance_screen.dart';
import '../policy/policy_screen.dart';
import '../reports/reports_screen.dart';
import '../organisation/organisation_screen.dart';
import '../vat/vat_screen.dart';

/// All navigation destinations in the app.
class NavDestination {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool mobileVisible;
  final bool Function(NucleusUser?)? roleCheck;

  const NavDestination({
    required this.label,
    required this.icon,
    required this.activeIcon,
    this.mobileVisible = false,
    this.roleCheck,
  });
}

final List<NavDestination> _allDestinations = [
  const NavDestination(
    label: 'Home',
    icon: Icons.home,
    activeIcon: Icons.home,
    mobileVisible: true,
  ),
  const NavDestination(
    label: 'My Claims',
    icon: Icons.receipt_long,
    activeIcon: Icons.receipt_long,
    mobileVisible: true,
  ),
  NavDestination(
    label: 'Approvals',
    icon: Icons.task_alt,
    activeIcon: Icons.task_alt,
    mobileVisible: true,
    roleCheck: (_) => true, // badge handled separately
  ),
  const NavDestination(
    label: 'Reports',
    icon: Icons.chat,
    activeIcon: Icons.chat,
    mobileVisible: true,
  ),
  const NavDestination(
    label: 'Policy Rules',
    icon: Icons.shield,
    activeIcon: Icons.shield,
  ),
  NavDestination(
    label: 'Audit',
    icon: Icons.fact_check,
    activeIcon: Icons.fact_check,
    roleCheck: (u) => u?.isAuditor ?? false,
  ),
  NavDestination(
    label: 'VAT Recovery',
    icon: Icons.request_quote,
    activeIcon: Icons.request_quote,
    roleCheck: (u) => u?.isVatOfficer ?? false,
  ),
  NavDestination(
    label: 'Finance',
    icon: Icons.account_balance,
    activeIcon: Icons.account_balance,
    roleCheck: (u) => u?.isFinanceApprover ?? false,
  ),
  const NavDestination(
    label: 'Organisation',
    icon: Icons.account_tree,
    activeIcon: Icons.account_tree,
  ),
];

/// Placeholder widgets for each destination — will be replaced by real screens.
Widget _screenForIndex(int index) {
  const screens = [
    DashboardScreen(),
    ClaimsScreen(),
    ApprovalsScreen(),
    ReportsScreen(),
    PolicyScreen(),
    AuditScreen(),
    VatScreen(),
    FinanceScreen(),
    OrganisationScreen(),
  ];
  return screens[index];
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  /// Access the shell state from any descendant to switch tabs.
  static AppShellState? of(BuildContext context) =>
      context.findAncestorStateOfType<AppShellState>();

  @override
  State<AppShell> createState() => AppShellState();
}

class AppShellState extends State<AppShell> {
  int _selectedIndex = 0;

  /// Navigate to a destination by its full index.
  /// Use from child screens via: AppShell.of(context).navigateTo(2)
  void navigateTo(int index) => setState(() => _selectedIndex = index);

  /// Map the 4 mobile bottom-nav indices to the full destination indices.
  static const _mobileToFullIndex = [0, 1, 2, 3];

  /// Get desktop-visible destinations for the current user.
  List<int> _desktopIndices(NucleusUser? user) {
    final indices = <int>[];
    for (var i = 0; i < _allDestinations.length; i++) {
      final dest = _allDestinations[i];
      if (dest.roleCheck != null && !dest.roleCheck!(user)) continue;
      indices.add(i);
    }
    return indices;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > kMobileBreakpoint;
        if (isDesktop) {
          return _DesktopLayout(
            selectedIndex: _selectedIndex,
            desktopIndices: _desktopIndices(auth.currentUser),
            onDestinationSelected: (i) => setState(() => _selectedIndex = i),
            child: _screenForIndex(_selectedIndex),
          );
        }
        // Mobile: map selected index to mobile range
        final mobileIndex = _mobileToFullIndex.contains(_selectedIndex)
            ? _mobileToFullIndex.indexOf(_selectedIndex)
            : 0;
        return _MobileLayout(
          selectedIndex: mobileIndex,
          onDestinationSelected: (i) =>
              setState(() => _selectedIndex = _mobileToFullIndex[i]),
          child: _screenForIndex(
              _mobileToFullIndex[mobileIndex]),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// DESKTOP LAYOUT — sidebar + content
// ---------------------------------------------------------------------------

class _DesktopLayout extends StatelessWidget {
  final int selectedIndex;
  final List<int> desktopIndices;
  final ValueChanged<int> onDestinationSelected;
  final Widget child;

  const _DesktopLayout({
    required this.selectedIndex,
    required this.desktopIndices,
    required this.onDestinationSelected,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          _DesktopSidebar(
            selectedIndex: selectedIndex,
            desktopIndices: desktopIndices,
            onDestinationSelected: onDestinationSelected,
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _DesktopSidebar extends StatelessWidget {
  final int selectedIndex;
  final List<int> desktopIndices;
  final ValueChanged<int> onDestinationSelected;

  const _DesktopSidebar({
    required this.selectedIndex,
    required this.desktopIndices,
    required this.onDestinationSelected,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    return Container(
      width: 240,
      color: NucleusColors.primaryNavy,
      child: Column(
        children: [
          // Logo header
          Container(
            height: 64,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            alignment: Alignment.centerLeft,
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: NucleusColors.accentTeal,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    'N',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Nucleus',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: Colors.white12, height: 1),

          // Navigation items
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: desktopIndices.map((fullIndex) {
                final dest = _allDestinations[fullIndex];
                final isActive = selectedIndex == fullIndex;
                return _SidebarItem(
                  icon: isActive ? dest.activeIcon : dest.icon,
                  label: dest.label,
                  isActive: isActive,
                  badge: fullIndex == 2 ? auth.pendingApprovals : 0,
                  onTap: () => onDestinationSelected(fullIndex),
                );
              }).toList(),
            ),
          ),

          const Divider(color: Colors.white12, height: 1),

          // User card — cross-fade on persona switch
          if (user != null)
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: _SidebarUserCard(
                key: ValueKey(user.id),
                user: user,
                onTap: () => UserSwitcher.show(context, isDesktop: true),
              ),
            ),
        ],
      ),
    );
  }
}

class _SidebarItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final int badge;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.badge = 0,
  });

  @override
  State<_SidebarItem> createState() => _SidebarItemState();
}

class _SidebarItemState extends State<_SidebarItem> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: widget.isActive
                ? NucleusColors.sidebarActive
                : _hovering
                    ? NucleusColors.sidebarHover
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: widget.isActive
                ? const Border(
                    left: BorderSide(
                      color: NucleusColors.accentTeal,
                      width: 4,
                    ),
                  )
                : null,
          ),
          child: Row(
            children: [
              Icon(
                widget.icon,
                size: 20,
                color: widget.isActive
                    ? NucleusColors.accentTeal
                    : Colors.white70,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  widget.label,
                  style: TextStyle(
                    color: widget.isActive
                        ? NucleusColors.accentTeal
                        : Colors.white,
                    fontWeight:
                        widget.isActive ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
              ),
              if (widget.badge > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: NucleusColors.accentTeal,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${widget.badge}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SidebarUserCard extends StatefulWidget {
  final NucleusUser user;
  final VoidCallback onTap;

  const _SidebarUserCard({super.key, required this.user, required this.onTap});

  @override
  State<_SidebarUserCard> createState() => _SidebarUserCardState();
}

class _SidebarUserCardState extends State<_SidebarUserCard> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(16),
          color: _hovering ? NucleusColors.sidebarHover : Colors.transparent,
          child: Row(
            children: [
              NucleusAvatar(
                initials: widget.user.initials,
                backgroundColor: Color(widget.user.avatarColor),
                size: 36,
                fontSize: 13,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.user.fullName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.user.jobTitle,
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: Colors.white38,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// MOBILE LAYOUT — bottom nav + app bar
// ---------------------------------------------------------------------------

class _MobileLayout extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final Widget child;

  const _MobileLayout({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final pendingCount = auth.pendingApprovals;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: const BoxDecoration(
                color: NucleusColors.accentTeal,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Text(
                'N',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text('Nucleus'),
          ],
        ),
        actions: [
          if (user != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => UserSwitcher.show(context, isDesktop: false),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 350),
                  switchInCurve: Curves.easeOut,
                  switchOutCurve: Curves.easeIn,
                  child: NucleusAvatar(
                    key: ValueKey(user.id),
                    initials: user.initials,
                    backgroundColor: Color(user.avatarColor),
                    size: 32,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: onDestinationSelected,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'My Claims',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: pendingCount > 0,
              label: Text('$pendingCount'),
              child: const Icon(Icons.task_alt_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: pendingCount > 0,
              label: Text('$pendingCount'),
              child: const Icon(Icons.task_alt),
            ),
            label: 'Approvals',
          ),
          const NavigationDestination(
            icon: Icon(Icons.chat_outlined),
            selectedIcon: Icon(Icons.chat),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}
