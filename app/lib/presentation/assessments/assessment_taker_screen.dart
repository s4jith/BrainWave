import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../data/models/assessment_model.dart';
import '../../data/repositories/assessment_repository.dart';
import 'assessment_provider.dart';

class AssessmentTakerScreen extends ConsumerStatefulWidget {
  final String assessmentId;
  const AssessmentTakerScreen({super.key, required this.assessmentId});

  @override
  ConsumerState<AssessmentTakerScreen> createState() =>
      _AssessmentTakerScreenState();
}

class _AssessmentTakerScreenState
    extends ConsumerState<AssessmentTakerScreen> {
  int _index = 0;
  final Map<String, AnswerSubmission> _answers = {};
  final Set<String> _flagged = {};
  final Map<String, TextEditingController> _textCtrls = {};
  Timer? _timer;
  int? _secondsLeft;
  bool _initialized = false;
  bool _submitting = false;

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _textCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _initTimer(StudentAssessment a) {
    _initialized = true;
    final limit = a.timeLimitMinutes;
    if (limit == null || limit <= 0) return;
    _secondsLeft = limit * 60;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      final left = (_secondsLeft ?? 0) - 1;
      if (left <= 0) {
        t.cancel();
        setState(() => _secondsLeft = 0);
        _submit(a, auto: true);
      } else {
        setState(() => _secondsLeft = left);
      }
    });
  }

  TextEditingController _ctrlFor(String questionId) {
    return _textCtrls.putIfAbsent(questionId, () {
      final existing = _answers[questionId]?.answerText ?? '';
      return TextEditingController(text: existing);
    });
  }

  void _setChoice(AssessmentQuestion q, String optionId) {
    setState(() {
      if (q.isMulti) {
        final current = List<String>.from(
            _answers[q.id]?.selectedOptionIds ?? const []);
        current.contains(optionId)
            ? current.remove(optionId)
            : current.add(optionId);
        _answers[q.id] =
            AnswerSubmission(questionId: q.id, selectedOptionIds: current);
      } else {
        _answers[q.id] =
            AnswerSubmission(questionId: q.id, selectedOptionIds: [optionId]);
      }
    });
  }

  void _setBool(AssessmentQuestion q, bool value) {
    setState(() =>
        _answers[q.id] = AnswerSubmission(questionId: q.id, answerBool: value));
  }

  void _setText(AssessmentQuestion q, String text) {
    _answers[q.id] = AnswerSubmission(questionId: q.id, answerText: text);
  }

  Future<bool> _confirmExit() => context.confirm(
        title: 'Leave assessment?',
        message: 'Your answers will not be submitted if you leave now.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep going',
        destructive: true,
      );

  Future<void> _submit(StudentAssessment a, {bool auto = false}) async {
    if (_submitting) return;
    if (!auto) {
      final answered = _answers.values.where((x) => x.isAnswered).length;
      final ok = await context.confirm(
        title: 'Submit assessment?',
        message:
            'You have answered $answered of ${a.questions.length} questions. Submit now?',
        confirmLabel: 'Submit',
      );
      if (!ok) return;
    }
    _timer?.cancel();
    setState(() => _submitting = true);
    try {
      final answers =
          a.questions.map((q) => _answers[q.id] ?? AnswerSubmission(questionId: q.id)).toList();
      final detail = await ref
          .read(assessmentRepositoryProvider)
          .submit(assessmentId: widget.assessmentId, answers: answers);
      ref.invalidate(mySubmissionsProvider);
      ref.invalidate(assessmentsListProvider);
      if (mounted) {
        context.pushReplacement('/assessment-result', extra: detail.id);
      }
    } on ApiException catch (e) {
      if (mounted) {
        context.showSnack(e.message, isError: true);
        setState(() => _submitting = false);
      }
    } catch (_) {
      if (mounted) {
        context.showSnack('Could not submit. Please try again.', isError: true);
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(studentAssessmentProvider(widget.assessmentId));
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop && await _confirmExit() && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () async {
              if (await _confirmExit() && context.mounted) context.pop();
            },
          ),
          title: Text(async.asData?.value.title ?? 'Assessment',
              maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            if (_secondsLeft != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Icon(Icons.timer_outlined,
                          size: 16,
                          color: _secondsLeft! < 60
                              ? context.palette.destructive
                              : context.palette.mutedForeground),
                      const SizedBox(width: 4),
                      Text(Formatters.duration(_secondsLeft!),
                          style: context.texts.titleSmall?.copyWith(
                              color: _secondsLeft! < 60
                                  ? context.palette.destructive
                                  : context.palette.foreground)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        body: async.when(
          loading: () => const LoadingView(message: 'Preparing your assessment…'),
          error: (e, _) => ErrorView(
            message:
                e is ApiException ? e.message : 'Could not start the assessment.',
            onRetry: () =>
                ref.invalidate(studentAssessmentProvider(widget.assessmentId)),
          ),
          data: (a) {
            if (a.questions.isEmpty) {
              return const EmptyState(
                icon: Icons.assignment_outlined,
                title: 'No questions',
                message: 'This assessment has no questions.',
              );
            }
            if (!_initialized) {
              // Set synchronously so a rebuild before the post-frame callback
              // can't schedule (and start) the countdown timer twice.
              _initialized = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _initTimer(a));
              });
            }
            return _body(a);
          },
        ),
      ),
    );
  }

  Widget _body(StudentAssessment a) {
    final p = context.palette;
    final q = a.questions[_index];
    final answered = _answers.values.where((x) => x.isAnswered).length;
    return Column(
      children: [
        LinearProgressIndicator(
          value: (_index + 1) / a.questions.length,
          minHeight: 4,
          backgroundColor: p.muted,
          valueColor: AlwaysStoppedAnimation(p.primary),
        ),
        _questionStrip(a),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Question ${_index + 1} of ${a.questions.length}',
                          style: context.texts.labelMedium
                              ?.copyWith(color: p.mutedForeground)),
                    ),
                    TextButton.icon(
                      onPressed: () => setState(() => _flagged.contains(q.id)
                          ? _flagged.remove(q.id)
                          : _flagged.add(q.id)),
                      icon: Icon(
                          _flagged.contains(q.id)
                              ? Icons.flag_rounded
                              : Icons.flag_outlined,
                          size: 18,
                          color: _flagged.contains(q.id)
                              ? p.warning
                              : p.mutedForeground),
                      label: Text(_flagged.contains(q.id) ? 'Flagged' : 'Flag'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(q.questionText, style: context.texts.titleMedium),
                if (q.points > 0) ...[
                  const SizedBox(height: 6),
                  Text('${q.points} ${q.points == 1 ? 'point' : 'points'}',
                      style: context.texts.labelSmall
                          ?.copyWith(color: p.mutedForeground)),
                ],
                const SizedBox(height: 18),
                ..._answerWidgets(q),
              ],
            ),
          ),
        ),
        _bottomBar(a, answered),
      ],
    );
  }

  Widget _questionStrip(StudentAssessment a) {
    final p = context.palette;
    return Container(
      height: 52,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: p.border)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: a.questions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final q = a.questions[i];
          final isCurrent = i == _index;
          final isAnswered = _answers[q.id]?.isAnswered ?? false;
          final isFlagged = _flagged.contains(q.id);
          return GestureDetector(
            onTap: () => setState(() => _index = i),
            child: Container(
              width: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isCurrent
                    ? p.primary
                    : isAnswered
                        ? p.muted
                        : p.card,
                borderRadius: BorderRadius.circular(AppRadius.sm),
                border: Border.all(
                    color: isFlagged
                        ? p.warning
                        : (isCurrent ? p.primary : p.border)),
              ),
              child: Text('${i + 1}',
                  style: context.texts.labelMedium?.copyWith(
                      color: isCurrent ? p.primaryForeground : p.foreground)),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _answerWidgets(AssessmentQuestion q) {
    final p = context.palette;
    if (q.isBoolean) {
      final current = _answers[q.id]?.answerBool;
      return [true, false].map((val) {
        final sel = current == val;
        return _optionTile(
          label: val ? 'True' : 'False',
          selected: sel,
          onTap: () => _setBool(q, val),
          leading: Icon(
              sel
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: sel ? p.primaryForeground : p.mutedForeground,
              size: 20),
        );
      }).toList();
    }

    if (q.isChoice) {
      final selectedIds = _answers[q.id]?.selectedOptionIds ?? const [];
      return q.options.map((opt) {
        final sel = selectedIds.contains(opt.id);
        return _optionTile(
          label: opt.text,
          selected: sel,
          onTap: () => _setChoice(q, opt.id),
          leading: Icon(
              q.isMulti
                  ? (sel
                      ? Icons.check_box_rounded
                      : Icons.check_box_outline_blank_rounded)
                  : (sel
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded),
              color: sel ? p.primaryForeground : p.mutedForeground,
              size: 20),
        );
      }).toList();
    }

    // Text-based (short answer / essay / fill blank)
    return [
      TextField(
        controller: _ctrlFor(q.id),
        minLines: q.type == 'essay' ? 5 : 2,
        maxLines: 12,
        onChanged: (v) => _setText(q, v),
        textCapitalization: TextCapitalization.sentences,
        decoration: const InputDecoration(
          hintText: 'Type your answer…',
          alignLabelWithHint: true,
        ),
      ),
    ];
  }

  Widget _optionTile({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    required Widget leading,
  }) {
    final p = context.palette;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? p.primary : p.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: selected ? p.primary : p.border),
        ),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                  style: context.texts.bodyMedium?.copyWith(
                      color: selected ? p.primaryForeground : p.foreground)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bottomBar(StudentAssessment a, int answered) {
    final p = context.palette;
    final isFirst = _index == 0;
    final isLast = _index == a.questions.length - 1;
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, 10 + MediaQuery.of(context).viewPadding.bottom),
      decoration: BoxDecoration(
        color: p.background,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('$answered of ${a.questions.length} answered',
                style: context.texts.bodySmall
                    ?.copyWith(color: p.mutedForeground)),
          ),
          const SizedBox(height: 10),
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
                        onPressed: _submitting ? null : () => _submit(a),
                        child: _submitting
                            ? SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: p.primaryForeground))
                            : const Text('Submit'),
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
