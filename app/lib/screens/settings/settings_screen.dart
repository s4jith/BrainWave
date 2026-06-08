import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/auth_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _isLoggingOut = false;

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Sign Out?'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign Out', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _isLoggingOut = true);
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/login');
  }

  void _showChangePasswordSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ChangePasswordSheet(
        onSave: (current, newPwd) async {
          await ref.read(authServiceProvider).changePassword(current, newPwd);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile & Settings')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildProfileHeader(user),
            const SizedBox(height: 8),
            _buildSection('Account', [
              _buildTile(Icons.email_outlined, 'Email', user?.email ?? ''),
              _buildTile(Icons.school_outlined, 'Class', user?.classLevel ?? ''),
              _buildTile(Icons.person_outline, 'Role', (user?.role ?? '').toUpperCase()),
            ]),
            _buildSection('Subjects', [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: (user?.subjects ?? []).map((s) => Chip(
                    label: Text(s),
                    backgroundColor: AppTheme.primary.withOpacity(0.1),
                    side: const BorderSide(color: AppTheme.primary, width: 0.5),
                    labelStyle: const TextStyle(color: AppTheme.primary, fontSize: 12),
                  )).toList(),
                ),
              ),
            ]),
            _buildSection('Security', [
              _buildActionTile(Icons.lock_outlined, 'Change Password', _showChangePasswordSheet),
            ]),
            _buildSection('Navigation', [
              _buildNavTile(Icons.bar_chart, 'Report Card', '/report-card'),
              _buildNavTile(Icons.people_outline, 'My Groups', '/groups'),
              _buildNavTile(Icons.question_answer_outlined, 'My Queries', '/queries'),
              _buildNavTile(Icons.grade_outlined, 'Gradebook', '/gradebook'),
              _buildNavTile(Icons.work_outline, 'Career Test', '/career'),
              _buildNavTile(Icons.support_outlined, 'Support Tickets', '/support'),
            ]),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: _isLoggingOut ? null : _logout,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.error,
                    side: const BorderSide(color: AppTheme.error),
                  ),
                  icon: _isLoggingOut
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.error))
                      : const Icon(Icons.logout),
                  label: const Text('Sign Out'),
                ),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'BrainWave v1.0.0 • NCERT AI Learning',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondaryDark),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader(user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.bgDark, AppTheme.surfaceDark],
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                user?.initials ?? 'S',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 32),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(user?.name ?? 'Student', style: Theme.of(context).textTheme.titleLarge),
          Text(user?.email ?? '', style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppTheme.textSecondaryDark, fontWeight: FontWeight.w600, letterSpacing: 1,
          )),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: AppTheme.cardDark,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.borderDark),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildTile(IconData icon, String title, String value) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.textSecondaryDark, size: 20),
      title: Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondaryDark)),
      trailing: Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textPrimaryDark)),
      dense: true,
    );
  }

  Widget _buildActionTile(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.textSecondaryDark, size: 20),
      title: Text(title, style: Theme.of(context).textTheme.bodyMedium),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondaryDark),
      onTap: onTap,
      dense: true,
    );
  }

  Widget _buildNavTile(IconData icon, String title, String path) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.textSecondaryDark, size: 20),
      title: Text(title, style: Theme.of(context).textTheme.bodyMedium),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondaryDark),
      onTap: () => context.push(path),
      dense: true,
    );
  }
}

class _ChangePasswordSheet extends StatefulWidget {
  final Future<void> Function(String, String) onSave;
  const _ChangePasswordSheet({required this.onSave});

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _isSaving = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_newCtrl.text != _confirmCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match'), backgroundColor: AppTheme.error),
      );
      return;
    }
    setState(() => _isSaving = true);
    try {
      await widget.onSave(_currentCtrl.text, _newCtrl.text);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password changed successfully'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to change password'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Change Password', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(controller: _currentCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Current Password', prefixIcon: Icon(Icons.lock_outlined))),
          const SizedBox(height: 12),
          TextField(controller: _newCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock_reset))),
          const SizedBox(height: 12),
          TextField(controller: _confirmCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm New Password', prefixIcon: Icon(Icons.lock_reset))),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 52,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Change Password'),
            ),
          ),
        ],
      ),
    );
  }
}
