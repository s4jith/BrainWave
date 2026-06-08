import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/ui_helpers.dart';
import '../../data/models/test_model.dart';
import '../../data/repositories/test_repository.dart';

/// Takes a [TestSession], collects answers (ephemeral UI state), and submits via
/// the repository. One question per screen with a progress bar and nav bar.
class TestSessionScreen extends ConsumerStatefulWidget {
  final TestSession? session;
  const TestSessionScreen({super.key, this.session});

  @override
  ConsumerState<TestSessionScreen> createState() => _TestSessionScreenState();
}

class _TestSessionScreenState extends ConsumerState<TestSessionScreen> {
  int _index = 0;
  final Map<int, int> _answers = {};
  bool _submitting = false;

  TestSession? get session => widget.session;

  Future<bool> _confirmExit() => context.confirm(
        title: 'Leave test?',
        message: 'Your progress will be lost if you exit now.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep going',
        destructive: true,
      );

  Future<void> _submit() async {
    final questions = session!.questions;
    final answers = List.generate(questions.length, (i) => _answers[i] ?? -1);
    setState(() => _submitting = true);
    try {
      final result = await ref.read(testRepositoryProvider).completeTest(
            testId: session!.testId,
            answers: answers,
          );
      if (mounted) context.pushReplacement('/test-result', extra: result);
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not submit the test.', isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = session;
    if (s == null || s.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test')),
        body: const Center(child: Text('No questions available.')),
      );
    }
    final questions = s.questions;
    final question = questions[_index];
    final progress = (_index + 1) / questions.length;
    final p = context.palette;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop && await _confirmExit() && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(s.subject),
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () async {
              if (await _confirmExit() && context.mounted) context.pop();
            },
          ),
          actions: [
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text('${_index + 1} / ${questions.length}',
                    style: context.texts.titleSmall),
              ),
            ),
          ],
        ),
        body: Column(
          children: [
            LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: p.muted,
              valueColor: AlwaysStoppedAnimation(p.primary),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: p.card,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: p.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Question ${_index + 1}',
                              style: context.texts.labelMedium
                                  ?.copyWith(color: p.mutedForeground)),
                          const SizedBox(height: 8),
                          Text(question.question,
                              style: context.texts.titleMedium),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    ..._options(question),
                  ],
                ),
              ),
            ),
            _bottomBar(questions.length),
          ],
        ),
      ),
    );
  }

  List<Widget> _options(TestQuestion q) {
    final p = context.palette;
    final selected = _answers[_index];
    return List.generate(q.options.length, (i) {
      final isSel = selected == i;
      return GestureDetector(
        onTap: () => setState(() => _answers[_index] = i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isSel ? p.primary : p.card,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: isSel ? p.primary : p.border),
          ),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSel ? p.primaryForeground : p.muted,
                ),
                child: Text(String.fromCharCode(65 + i),
                    style: context.texts.labelMedium?.copyWith(
                        color: isSel ? p.primary : p.foreground)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(q.options[i],
                    style: context.texts.bodyMedium?.copyWith(
                        color: isSel ? p.primaryForeground : p.foreground)),
              ),
            ],
          ),
        ),
      );
    });
  }

  Widget _bottomBar(int total) {
    final p = context.palette;
    final isFirst = _index == 0;
    final isLast = _index == total - 1;
    final answered = _answers.length;
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, 12 + MediaQuery.of(context).viewPadding.bottom),
      decoration: BoxDecoration(
        color: p.background,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$answered of $total answered',
                  style: context.texts.bodySmall
                      ?.copyWith(color: p.mutedForeground)),
              Text('${((answered / total) * 100).round()}%',
                  style: context.texts.bodySmall),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (!isFirst) ...[
                OutlinedButton(
                  onPressed: () => setState(() => _index--),
                  child: const Text('Back'),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: isLast
                    ? FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: p.primaryForeground),
                              )
                            : const Text('Submit test'),
                      )
                    : FilledButton(
                        onPressed: () => setState(() => _index++),
                        child: const Text('Next'),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
