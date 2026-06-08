import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/career_service.dart';
import '../../models/career_model.dart';
import '../../widgets/common/loading_widget.dart';

class CareerTestScreen extends ConsumerStatefulWidget {
  const CareerTestScreen({super.key});

  @override
  ConsumerState<CareerTestScreen> createState() => _CareerTestScreenState();
}

class _CareerTestScreenState extends ConsumerState<CareerTestScreen> {
  List<CareerQuestion> _questions = [];
  bool _isLoading = true;
  bool _testStarted = false;
  String? _testId;
  int _currentIndex = 0;
  // stores option index (0-3) keyed by question id
  final Map<String, int> _answers = {};
  bool _isSubmitting = false;
  bool _isStarting = false;

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    setState(() => _isLoading = true);
    try {
      final questions = await ref.read(careerServiceProvider).getQuestions();
      if (mounted) setState(() { _questions = questions; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startTest() async {
    setState(() => _isStarting = true);
    try {
      final testId = await ref.read(careerServiceProvider).startCareerTest();
      if (mounted) setState(() { _testId = testId; _testStarted = true; _isStarting = false; });
    } catch (e) {
      if (mounted) {
        setState(() => _isStarting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not start test: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _submitTest() async {
    if (_testId == null) return;
    setState(() => _isSubmitting = true);
    try {
      final answers = _answers.entries.map((e) => {
        'question_id': e.key,
        'selected_option': e.value,
      }).toList();
      final result = await ref.read(careerServiceProvider).submitCareerTest(_testId!, answers);
      if (mounted) context.pushReplacement('/career-result', extra: result.id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return Scaffold(appBar: AppBar(title: const Text('Career Test')), body: const LoadingWidget());
    if (!_testStarted) return _buildIntroScreen();
    return _buildTestScreen();
  }

  Widget _buildIntroScreen() {
    return Scaffold(
      appBar: AppBar(title: const Text('Career Test')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  const Icon(Icons.work_outline, color: Colors.white, size: 56),
                  const SizedBox(height: 16),
                  const Text('Career Aptitude Test', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(
                    'Discover careers that match your strengths and interests',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _buildInfoCard(Icons.quiz_outlined, '${_questions.length} Questions', 'Multiple choice aptitude questions'),
            const SizedBox(height: 10),
            _buildInfoCard(Icons.timer_outlined, '~15 Minutes', 'Take your time, no time limit'),
            const SizedBox(height: 10),
            _buildInfoCard(Icons.psychology_outlined, 'AI Analysis', 'Personalized career recommendations'),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _isStarting ? null : _startTest,
                icon: _isStarting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.play_arrow),
                label: Text(_isStarting ? 'Starting...' : 'Start Career Test'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(IconData icon, String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: AppTheme.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTestScreen() {
    final q = _questions[_currentIndex];
    final progress = (_currentIndex + 1) / _questions.length;
    final isLast = _currentIndex == _questions.length - 1;
    final selectedIndex = _answers[q.id];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Career Test'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => setState(() { _testStarted = false; _answers.clear(); _currentIndex = 0; }),
        ),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('${_currentIndex + 1}/${_questions.length}', style: Theme.of(context).textTheme.titleMedium),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: progress, backgroundColor: AppTheme.borderDark, valueColor: const AlwaysStoppedAnimation(AppTheme.primary), minHeight: 4),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                    ),
                    child: Text(q.question, style: Theme.of(context).textTheme.bodyLarge),
                  ),
                  const SizedBox(height: 20),
                  ...List.generate(q.options.length, (i) {
                    final opt = q.options[i];
                    final isSelected = selectedIndex == i;
                    return GestureDetector(
                      onTap: () => setState(() => _answers[q.id] = i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primary.withOpacity(0.15) : AppTheme.cardDark,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? AppTheme.primary : AppTheme.borderDark, width: isSelected ? 2 : 1),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                              color: isSelected ? AppTheme.primary : AppTheme.textSecondaryDark,
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(opt, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textPrimaryDark))),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (_currentIndex > 0) ...[
                  OutlinedButton.icon(
                    onPressed: () => setState(() => _currentIndex--),
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Back'),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: ElevatedButton(
                    onPressed: selectedIndex == null ? null : () {
                      if (isLast) _submitTest();
                      else setState(() => _currentIndex++);
                    },
                    style: isLast ? ElevatedButton.styleFrom(backgroundColor: AppTheme.success) : null,
                    child: _isSubmitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(isLast ? 'Get Career Analysis' : 'Next'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
