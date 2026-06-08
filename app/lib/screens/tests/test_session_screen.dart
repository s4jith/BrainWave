import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../models/test_model.dart';
import '../../services/test_service.dart';

class TestSessionScreen extends ConsumerStatefulWidget {
  final TestSession? session;
  const TestSessionScreen({super.key, this.session});

  @override
  ConsumerState<TestSessionScreen> createState() => _TestSessionScreenState();
}

class _TestSessionScreenState extends ConsumerState<TestSessionScreen> {
  int _currentIndex = 0;
  final Map<int, int> _answers = {};
  bool _isSubmitting = false;

  TestSession? get session => widget.session;

  @override
  Widget build(BuildContext context) {
    if (session == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test')),
        body: const Center(child: Text('No test session found')),
      );
    }
    final questions = session!.questions;
    if (questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test')),
        body: const Center(child: Text('No questions available')),
      );
    }
    final question = questions[_currentIndex];
    final progress = (_currentIndex + 1) / questions.length;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          if (await _confirmExit() && mounted) context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(session!.subject),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () async {
              if (await _confirmExit() && mounted) context.pop();
            },
          ),
          actions: [
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  '${_currentIndex + 1}/${questions.length}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ),
          ],
        ),
        body: Column(
          children: [
            LinearProgressIndicator(
              value: progress,
              backgroundColor: AppTheme.borderDark,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
              minHeight: 4,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildQuestionCard(question),
                    const SizedBox(height: 24),
                    ..._buildOptions(question),
                  ],
                ),
              ),
            ),
            _buildBottomBar(questions.length),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionCard(TestQuestion q) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primary.withOpacity(0.15), AppTheme.secondary.withOpacity(0.1)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Question ${_currentIndex + 1}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.primary),
          ),
          const SizedBox(height: 8),
          Text(q.question, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }

  List<Widget> _buildOptions(TestQuestion q) {
    final selected = _answers[_currentIndex];
    return List.generate(q.options.length, (i) {
      final isSelected = selected == i;
      final optionLabel = String.fromCharCode(65 + i); // A, B, C, D
      return GestureDetector(
        onTap: () => setState(() => _answers[_currentIndex] = i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary.withOpacity(0.15) : AppTheme.cardDark,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? AppTheme.primary : AppTheme.borderDark,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? AppTheme.primary : AppTheme.surfaceDark,
                ),
                child: Center(
                  child: Text(
                    optionLabel,
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppTheme.textSecondaryDark,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  q.options[i],
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isSelected ? AppTheme.textPrimaryDark : AppTheme.textSecondaryDark,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  Widget _buildBottomBar(int total) {
    final isFirst = _currentIndex == 0;
    final isLast = _currentIndex == total - 1;
    final answered = _answers.length;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        border: Border(top: BorderSide(color: AppTheme.borderDark)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$answered/$total answered', style: Theme.of(context).textTheme.bodySmall),
              Text(
                '${((answered / total) * 100).round()}% complete',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.primary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (!isFirst)
                OutlinedButton.icon(
                  onPressed: () => setState(() => _currentIndex--),
                  icon: const Icon(Icons.arrow_back, size: 18),
                  label: const Text('Back'),
                ),
              if (!isFirst) const SizedBox(width: 12),
              Expanded(
                child: isLast
                    ? ElevatedButton(
                        onPressed: _isSubmitting ? null : _submitTest,
                        style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                        child: _isSubmitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Submit Test'),
                      )
                    : ElevatedButton.icon(
                        onPressed: () => setState(() => _currentIndex++),
                        icon: const Icon(Icons.arrow_forward, size: 18),
                        label: const Text('Next'),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _submitTest() async {
    final questions = session!.questions;
    final answers = List.generate(questions.length, (i) => _answers[i] ?? -1);
    setState(() => _isSubmitting = true);
    try {
      final result = await ref.read(testServiceProvider).completeAITest(
        testId: session!.testId,
        answers: answers,
      );
      if (mounted) {
        context.pushReplacement('/test-result', extra: result);
      }
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

  Future<bool> _confirmExit() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Exit Test?'),
        content: const Text('Your progress will be lost. Are you sure?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Continue Test')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Exit', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    return confirm ?? false;
  }
}
