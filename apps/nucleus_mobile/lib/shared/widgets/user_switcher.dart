import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../models/user.dart';
import 'nucleus_avatar.dart';

class UserSwitcher extends StatelessWidget {
  const UserSwitcher({super.key});

  static void show(BuildContext context, {required bool isDesktop}) {
    if (isDesktop) {
      _showDesktopDropdown(context);
    } else {
      _showMobileBottomSheet(context);
    }
  }

  static void _showMobileBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => const _UserSwitcherContent(),
    );
  }

  static void _showDesktopDropdown(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        alignment: Alignment.bottomLeft,
        insetPadding: const EdgeInsets.only(left: 8, bottom: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: SizedBox(
          width: 320,
          child: const _UserSwitcherContent(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _UserSwitcherContent extends StatelessWidget {
  const _UserSwitcherContent();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final currentUser = auth.currentUser;
    final users = auth.availableUsers;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          child: Text(
            'Select Persona',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy,
                ),
          ),
        ),
        const Divider(height: 1),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 400),
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: users.length,
            itemBuilder: (context, index) {
              final user = users[index];
              final isActive = currentUser?.id == user.id;
              return _UserTile(
                user: user,
                isActive: isActive,
                onTap: () async {
                  Navigator.of(context).pop();
                  await auth.switchUser(user.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Now viewing as ${user.fullName}'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
              );
            },
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _UserTile extends StatelessWidget {
  final NucleusUser user;
  final bool isActive;
  final VoidCallback onTap;

  const _UserTile({
    required this.user,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? NucleusColors.accentTeal.withValues(alpha: 0.08) : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: isActive
                ? const Border(
                    left: BorderSide(
                      color: NucleusColors.accentTeal,
                      width: 4,
                    ),
                  )
                : null,
          ),
          padding: EdgeInsets.fromLTRB(
            isActive ? 12 : 16,
            12,
            16,
            12,
          ),
          child: Row(
            children: [
              NucleusAvatar(
                initials: user.initials,
                backgroundColor: Color(user.avatarColor),
                size: 36,
                fontSize: 13,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.fullName,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.jobTitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              if (isActive)
                Icon(
                  Icons.check_circle,
                  size: 20,
                  color: NucleusColors.accentTeal,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
