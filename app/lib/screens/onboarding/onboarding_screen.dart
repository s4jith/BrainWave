import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/auth_service.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageCtrl = PageController();
  int _currentPage = 0;
  bool _isLoading = false;

  // Step 1 data
  String? _selectedClass;

  // Step 2 data
  final Set<String> _selectedSubjects = {};

  // Step 3 data
  final _nameCtrl = TextEditingController();

  @override
  void dispose() {
    _pageCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    if (_selectedClass == null || _selectedSubjects.isEmpty) return;
    final userId = ref.read(authProvider).user?.userId ?? '';
    if (userId.isEmpty) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(authServiceProvider).completeOnboarding(
        userId: userId,
        name: _nameCtrl.text.trim(),
        classLevel: _selectedClass!,
      );
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) context.go('/dashboard');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save. Try again.'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _nextPage() {
    if (_currentPage < 2) {
      _pageCtrl.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _currentPage++);
    } else {
      _complete();
    }
  }

  bool get _canProceed {
    if (_currentPage == 0) return _selectedClass != null;
    if (_currentPage == 1) return _selectedSubjects.isNotEmpty;
    return _nameCtrl.text.trim().isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildProgressBar(),
            Expanded(
              child: PageView(
                controller: _pageCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildClassPage(),
                  _buildSubjectsPage(),
                  _buildProfilePage(),
                ],
              ),
            ),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: List.generate(3, (i) {
          return Expanded(
            child: Container(
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: i <= _currentPage ? AppTheme.primary : AppTheme.borderDark,
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildClassPage() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Which class are you in?', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('Select your current class', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 32),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 2.2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: AppConstants.classesList.length,
              itemBuilder: (_, i) {
                final cls = AppConstants.classesList[i];
                final isSelected = _selectedClass == cls;
                return GestureDetector(
                  onTap: () => setState(() => _selectedClass = cls),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : AppTheme.borderDark,
                        width: isSelected ? 2 : 1,
                      ),
                      color: isSelected ? AppTheme.primary.withOpacity(0.12) : AppTheme.cardDark,
                    ),
                    child: Center(
                      child: Text(
                        cls,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: isSelected ? AppTheme.primary : AppTheme.textPrimaryDark,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubjectsPage() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your subjects', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('Select all subjects you study', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 32),
          Expanded(
            child: ListView.separated(
              itemCount: AppConstants.subjects.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final subject = AppConstants.subjects[i];
                final isSelected = _selectedSubjects.contains(subject);
                return GestureDetector(
                  onTap: () => setState(() {
                    if (isSelected) _selectedSubjects.remove(subject);
                    else _selectedSubjects.add(subject);
                  }),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : AppTheme.borderDark,
                        width: isSelected ? 2 : 1,
                      ),
                      color: isSelected ? AppTheme.primary.withOpacity(0.12) : AppTheme.cardDark,
                    ),
                    child: Row(
                      children: [
                        Text(_subjectIcon(subject), style: const TextStyle(fontSize: 24)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Text(
                            subject,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: isSelected ? AppTheme.primary : AppTheme.textPrimaryDark,
                            ),
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.check_circle, color: AppTheme.primary),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfilePage() {
    final user = ref.watch(authProvider).user;
    if (_nameCtrl.text.isEmpty && user?.name.isNotEmpty == true) {
      _nameCtrl.text = user!.name;
    }
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("You're almost ready!", style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('Confirm your display name', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 32),
          TextField(
            controller: _nameCtrl,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Display name',
              prefixIcon: Icon(Icons.person_outlined),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          if (_currentPage > 0)
            OutlinedButton(
              onPressed: () {
                _pageCtrl.previousPage(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
                setState(() => _currentPage--);
              },
              child: const Text('Back'),
            ),
          if (_currentPage > 0) const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: _canProceed && !_isLoading ? _nextPage : null,
              child: _isLoading
                  ? const SizedBox(
                      width: 22, height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(_currentPage == 2 ? 'Get Started' : 'Continue'),
            ),
          ),
        ],
      ),
    );
  }

  String _subjectIcon(String subject) {
    return switch (subject) {
      'Mathematics' => '📐',
      'Science' => '🔬',
      'Physics' => '⚡',
      'Chemistry' => '🧪',
      'Biology' => '🌱',
      'Social Science' => '🌍',
      'English' => '📚',
      'Hindi' => '🔤',
      _ => '📖',
    };
  }
}
