import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/repositories/auth_repository.dart';
import '../providers/auth_provider.dart';

/// 3-step onboarding: class → subjects → display name.
/// Selection state is ephemeral UI; completion goes through the repository +
/// auth refresh, after which the router redirects to the dashboard.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageCtrl = PageController();
  final _nameCtrl = TextEditingController();
  int _page = 0;
  bool _loading = false;
  String? _selectedClass;
  final Set<String> _subjects = {};

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    if (user != null && user.name.isNotEmpty) _nameCtrl.text = user.name;
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  bool get _canProceed {
    if (_page == 0) return _selectedClass != null;
    if (_page == 1) return _subjects.isNotEmpty;
    return _nameCtrl.text.trim().isNotEmpty;
  }

  void _next() {
    if (_page < 2) {
      _pageCtrl.nextPage(
          duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
      setState(() => _page++);
    } else {
      _complete();
    }
  }

  void _back() {
    _pageCtrl.previousPage(
        duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
    setState(() => _page--);
  }

  Future<void> _complete() async {
    final user = ref.read(authProvider).user;
    if (user == null || _selectedClass == null || _subjects.isEmpty) return;
    setState(() => _loading = true);
    try {
      await ref.read(authRepositoryProvider).completeOnboarding(
            userId: user.userId,
            name: _nameCtrl.text.trim(),
            classLevel: _selectedClass!,
            subjects: _subjects.toList(),
          );
      await ref.read(authProvider.notifier).refresh();
      // Router redirect takes the user to the dashboard once onboarded.
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not save. Try again.', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _progress(),
            Expanded(
              child: PageView(
                controller: _pageCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [_classPage(), _subjectsPage(), _namePage()],
              ),
            ),
            _bottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _progress() {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      child: Row(
        children: List.generate(3, (i) {
          return Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              height: 5,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                color: i <= _page ? p.primary : p.border,
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _classPage() {
    final p = context.palette;
    return _PageBody(
      title: 'Which class are you in?',
      subtitle: 'Pick your current class to personalise content.',
      child: GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 2.4,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: AppConstants.classesList.length,
        itemBuilder: (_, i) {
          final cls = AppConstants.classesList[i];
          final selected = _selectedClass == cls;
          return GestureDetector(
            onTap: () => setState(() => _selectedClass = cls),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                    color: selected ? p.primary : p.border,
                    width: selected ? 2 : 1),
                color: selected ? p.primary : p.card,
              ),
              child: Center(
                child: Text(cls,
                    style: context.texts.titleMedium?.copyWith(
                        color: selected ? p.primaryForeground : p.foreground)),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _subjectsPage() {
    final p = context.palette;
    return _PageBody(
      title: 'Your subjects',
      subtitle: 'Select all the subjects you study.',
      child: ListView.separated(
        itemCount: AppConstants.subjects.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final subject = AppConstants.subjects[i];
          final selected = _subjects.contains(subject);
          return GestureDetector(
            onTap: () => setState(() => selected
                ? _subjects.remove(subject)
                : _subjects.add(subject)),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                    color: selected ? p.primary : p.border,
                    width: selected ? 2 : 1),
                color: p.card,
              ),
              child: Row(
                children: [
                  Text(Formatters.subjectEmoji(subject),
                      style: const TextStyle(fontSize: 22)),
                  const SizedBox(width: 14),
                  Expanded(
                      child:
                          Text(subject, style: context.texts.titleMedium)),
                  Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.circle_outlined,
                    color: selected ? p.primary : p.mutedForeground,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _namePage() {
    return _PageBody(
      title: "You're almost ready!",
      subtitle: 'Confirm the name you want to be shown as.',
      child: Column(
        children: [
          TextField(
            controller: _nameCtrl,
            onChanged: (_) => setState(() {}),
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Display name',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          if (_page > 0) ...[
            OutlinedButton(onPressed: _loading ? null : _back, child: const Text('Back')),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: PrimaryButton(
              label: _page == 2 ? 'Get started' : 'Continue',
              loading: _loading,
              onPressed: _canProceed ? _next : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _PageBody extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;

  const _PageBody(
      {required this.title, required this.subtitle, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.texts.headlineSmall),
          const SizedBox(height: 8),
          Text(subtitle,
              style: context.texts.bodyMedium
                  ?.copyWith(color: context.palette.mutedForeground)),
          const SizedBox(height: 28),
          Expanded(child: child),
        ],
      ),
    );
  }
}
