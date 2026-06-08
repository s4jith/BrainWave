import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/repositories/auth_repository.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  bool _loading = false;
  bool _sent = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(_emailCtrl.text.trim().toLowerCase());
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not send reset link.', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: _sent ? _buildSent(p) : _buildForm(p),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm(p) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: p.muted,
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(Icons.lock_reset_rounded, color: p.foreground, size: 28),
          ),
          const SizedBox(height: 20),
          Text('Forgot your password?', style: context.texts.headlineSmall),
          const SizedBox(height: 8),
          Text(
            'Enter the email linked to your account and we\'ll send you a reset link.',
            style: context.texts.bodyMedium?.copyWith(color: p.mutedForeground),
          ),
          const SizedBox(height: 28),
          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            decoration: const InputDecoration(
              labelText: 'Email address',
              prefixIcon: Icon(Icons.mail_outline_rounded),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Email is required';
              if (!v.contains('@')) return 'Enter a valid email';
              return null;
            },
          ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: 'Send reset link',
            loading: _loading,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }

  Widget _buildSent(p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: p.success.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Icon(Icons.mark_email_read_rounded, color: p.success, size: 28),
        ),
        const SizedBox(height: 20),
        Text('Check your inbox', style: context.texts.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'If an account exists for ${_emailCtrl.text.trim()}, a password reset link is on its way.',
          style: context.texts.bodyMedium?.copyWith(color: p.mutedForeground),
        ),
        const SizedBox(height: 28),
        PrimaryButton(
          label: 'Back to sign in',
          onPressed: () => context.go('/login'),
        ),
      ],
    );
  }
}
