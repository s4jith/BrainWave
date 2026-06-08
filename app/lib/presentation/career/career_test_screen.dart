import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/career_model.dart';
import '../../data/repositories/career_repository.dart';
import 'career_provider.dart';

class CareerTestScreen extends ConsumerStatefulWidget {
  const CareerTestScreen({super.key});

  @override
  ConsumerState<CareerTestScreen> createState() => _CareerTestScreenState();
}

class _CareerTestScreenState extends ConsumerState<CareerTestScreen> {
  bool _started = false;
  String? _testId;
  int _index = 0;
  final Map<String, int> _answers = {};
  bool _starting = false;
  bool _submitting = false;

  Future<void> _start() async {
    setState(() => _starting = true);
    try {
      final id = await ref.read(careerRepositoryProvider).startTest();
      if (mounted) {
        setState(() {
          _testId = id;
          _started = true;
          _index = 0;
        });
      }
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not start the test.', isError: true);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _submit() async {
    if (_testId == null) return;
    setState(() => _submitting = true);
    try {
      final answers = _answers.entries
          .map((e) => {'question_id': e.key, 'selected_option': e.value})
          .toList();
      final result =
          await ref.read(careerRepositoryProvider).submitTest(_testId!, answers);
      if (mounted) context.pushReplacement('/career-result', extra: result.id);
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
    final questions = ref.watch(careerQuestionsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Career Test'),
        leading: _started
            ? IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => setState(() {
                  _started = false;
                  _answers.clear();
                  _index = 0;
                }),
              )
            : null,
        actions: [
          if (_started)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  '${_index + 1} / ${questions.asData?.value.length ?? 0}',
                  style: context.texts.titleSmall,
                ),
              ),
            ),
        ],
      ),
      body: questions.when(
        loading: () => const LoadingView(message: 'Loading questions…'),
        error: (e, _) => ErrorView(
          message: e is ApiException ? e.message : 'Could not load the test.',
          onRetry: () => ref.invalidate(careerQuestionsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.work_outline_rounded,
              title: 'Test unavailable',
              message: 'The career test has no questions yet.',
            );
          }
          return _started ? _testBody(list) : _intro(list.length);
        },
      ),
    );
  }

  Widget _intro(int count) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            padding: const EdgeInsets.all(24),
            color: context.palette.primary,
            child: Column(
              children: [
                Icon(Icons.work_outline_rounded,
                    color: context.palette.primaryForeground, size: 48),
                const SizedBox(height: 14),
                Text('Career Aptitude Test',
                    style: context.texts.headlineSmall
                        ?.copyWith(color: context.palette.primaryForeground)),
                const SizedBox(height: 8),
                Text(
                  'Discover careers that match your strengths and interests.',
                  textAlign: TextAlign.center,
                  style: context.texts.bodyMedium?.copyWith(
                      color: context.palette.primaryForeground
                          .withValues(alpha: 0.85)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _info(Icons.quiz_outlined, '$count questions',
              'Multiple-choice aptitude questions'),
          const SizedBox(height: 10),
          _info(Icons.timer_outlined, '~15 minutes', 'No time limit — take your time'),
          const SizedBox(height: 10),
          _info(Icons.psychology_outlined, 'AI analysis',
              'Personalised career recommendations'),
          const SizedBox(height: 28),
          PrimaryButton(
            label: 'Start career test',
            icon: Icons.play_arrow_rounded,
            loading: _starting,
            onPressed: _start,
          ),
        ],
      ),
    );
  }

  Widget _info(IconData icon, String title, String subtitle) {
    final p = context.palette;
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: p.muted, shape: BoxShape.circle),
            child: Icon(icon, color: p.foreground, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.texts.titleSmall),
                Text(subtitle,
                    style: context.texts.bodySmall
                        ?.copyWith(color: p.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _testBody(List<CareerQuestion> questions) {
    final p = context.palette;
    final q = questions[_index];
    final isLast = _index == questions.length - 1;
    final selected = _answers[q.id];
    return Column(
      children: [
        LinearProgressIndicator(
          value: (_index + 1) / questions.length,
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
                  child: Text(q.question, style: context.texts.titleMedium),
                ),
                const SizedBox(height: 18),
                ...List.generate(q.options.length, (i) {
                  final isSel = selected == i;
                  return GestureDetector(
                    onTap: () => setState(() => _answers[q.id] = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isSel ? p.primary : p.card,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: isSel ? p.primary : p.border),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSel
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_off_rounded,
                            color:
                                isSel ? p.primaryForeground : p.mutedForeground,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(q.options[i],
                                style: context.texts.bodyMedium?.copyWith(
                                    color: isSel
                                        ? p.primaryForeground
                                        : p.foreground)),
                          ),
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
          padding: EdgeInsets.fromLTRB(
              16, 8, 16, 8 + MediaQuery.of(context).viewPadding.bottom),
          child: Row(
            children: [
              if (_index > 0) ...[
                OutlinedButton(
                  onPressed: () => setState(() => _index--),
                  child: const Text('Back'),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: FilledButton(
                  onPressed: selected == null
                      ? null
                      : (isLast
                          ? (_submitting ? null : _submit)
                          : () => setState(() => _index++)),
                  child: _submitting
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.2, color: p.primaryForeground))
                      : Text(isLast ? 'Get my analysis' : 'Next'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
