import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_provider.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/repositories/auth_repository.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final mode = ref.watch(themeModeProvider);
    final p = context.palette;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Profile header
          AppCard(
            child: Row(
              children: [
                AppAvatar(initials: user?.initials ?? 'S', size: 56),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name ?? 'Student',
                          style: context.texts.titleLarge),
                      const SizedBox(height: 2),
                      Text(user?.email ?? '',
                          style: context.texts.bodySmall
                              ?.copyWith(color: p.mutedForeground),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      if ((user?.classLevel ?? '').isNotEmpty) ...[
                        const SizedBox(height: 6),
                        StatusBadge(label: user!.classLevel, color: p.info),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if ((user?.subjects ?? []).isNotEmpty) ...[
            const SizedBox(height: 10),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Subjects',
                      style: context.texts.labelMedium
                          ?.copyWith(color: p.mutedForeground)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: user!.subjects
                        .map((s) => StatusBadge(label: s, color: p.foreground))
                        .toList(),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),
          const SectionHeader(title: 'Learning'),
          const SizedBox(height: 8),
          const _LinkTile(icon: Icons.insights_outlined, label: 'Report card', route: '/report-card'),
          const _LinkTile(icon: Icons.grade_outlined, label: 'Gradebook', route: '/gradebook'),
          const _LinkTile(icon: Icons.assignment_turned_in_outlined, label: 'Assessments', route: '/assessments'),
          const _LinkTile(icon: Icons.groups_outlined, label: 'My groups', route: '/groups'),
          const _LinkTile(icon: Icons.forum_outlined, label: 'My queries', route: '/queries'),
          const _LinkTile(icon: Icons.work_outline_rounded, label: 'Career test', route: '/career'),

          const SizedBox(height: 24),
          const SectionHeader(title: 'Help & feedback'),
          const SizedBox(height: 8),
          const _LinkTile(icon: Icons.support_agent_outlined, label: 'Support', route: '/support'),
          const _LinkTile(icon: Icons.lightbulb_outline_rounded, label: 'Suggestions', route: '/suggestions'),

          const SizedBox(height: 24),
          const SectionHeader(title: 'Appearance'),
          const SizedBox(height: 8),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(
                    value: ThemeMode.system,
                    label: Text('System'),
                    icon: Icon(Icons.brightness_auto_rounded)),
                ButtonSegment(
                    value: ThemeMode.light,
                    label: Text('Light'),
                    icon: Icon(Icons.light_mode_rounded)),
                ButtonSegment(
                    value: ThemeMode.dark,
                    label: Text('Dark'),
                    icon: Icon(Icons.dark_mode_rounded)),
              ],
              selected: {mode},
              showSelectedIcon: false,
              onSelectionChanged: (s) =>
                  ref.read(themeModeProvider.notifier).setMode(s.first),
            ),
          ),

          const SizedBox(height: 24),
          const SectionHeader(title: 'Account'),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.lock_outline_rounded,
            label: 'Change password',
            onTap: () => _changePassword(context, ref),
          ),
          _ActionTile(
            icon: Icons.logout_rounded,
            label: 'Sign out',
            destructive: true,
            onTap: () => _logout(context, ref),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text('BrainWave • NCERT AI Learning',
                style:
                    context.texts.bodySmall?.copyWith(color: p.mutedForeground)),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await context.confirm(
      title: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!ok) return;
    await ref.read(authProvider.notifier).logout();
    // Router redirect returns to /login.
  }

  Future<void> _changePassword(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      builder: (_) => const _ChangePasswordSheet(),
    );
  }
}

class _LinkTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String route;
  const _LinkTile(
      {required this.icon, required this.label, required this.route});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppCard(
        onTap: () => context.push(route),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 22, color: p.foreground),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: context.texts.titleSmall)),
            Icon(Icons.chevron_right_rounded, color: p.mutedForeground),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final color = destructive ? p.destructive : p.foreground;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: 14),
            Expanded(
                child: Text(label,
                    style: context.texts.titleSmall?.copyWith(color: color))),
          ],
        ),
      ),
    );
  }
}

class _ChangePasswordSheet extends ConsumerStatefulWidget {
  const _ChangePasswordSheet();

  @override
  ConsumerState<_ChangePasswordSheet> createState() =>
      _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends ConsumerState<_ChangePasswordSheet> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentCtrl.text;
    final next = _newCtrl.text;
    if (current.isEmpty || next.isEmpty) {
      context.showSnack('Fill in all fields.', isError: true);
      return;
    }
    if (next.length < 6) {
      context.showSnack('New password must be at least 6 characters.',
          isError: true);
      return;
    }
    if (next != _confirmCtrl.text) {
      context.showSnack('Passwords do not match.', isError: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).changePassword(current, next);
      if (mounted) {
        Navigator.of(context).pop();
        context.showSnack('Password updated');
      }
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not change password.', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Change password', style: context.texts.titleLarge),
          const SizedBox(height: 16),
          TextField(
            controller: _currentCtrl,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Current password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _newCtrl,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'New password'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirmCtrl,
            obscureText: true,
            decoration:
                const InputDecoration(labelText: 'Confirm new password'),
          ),
          const SizedBox(height: 20),
          PrimaryButton(
              label: 'Update password', loading: _busy, onPressed: _submit),
        ],
      ),
    );
  }
}
