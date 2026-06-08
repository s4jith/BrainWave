import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/test_model.dart';

/// Displays a [TestResult]: score ring, correct/wrong/total, and an optional
/// per-question review (present right after submitting).
class TestResultScreen extends StatelessWidget {
  final TestResult? result;
  const TestResultScreen({super.key, this.result});

  @override
  Widget build(BuildContext context) {
    final r = result;
    if (r == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Result')),
        body: const Center(child: Text('No result data.')),
      );
    }
    final p = context.palette;
    final color = r.percentage >= 80
        ? p.success
        : r.percentage >= 50
            ? p.warning
            : p.destructive;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Test result'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () => context.go('/tests'),
            child: const Text('Done'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          AppCard(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                CircularPercentIndicator(
                  radius: 68,
                  lineWidth: 11,
                  percent: (r.percentage / 100).clamp(0, 1),
                  circularStrokeCap: CircularStrokeCap.round,
                  progressColor: color,
                  backgroundColor: p.muted,
                  center: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${r.percentage.round()}%',
                          style: context.texts.headlineMedium
                              ?.copyWith(color: color)),
                      Text(r.grade,
                          style: context.texts.titleMedium
                              ?.copyWith(color: color)),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Text(_message(r.percentage),
                    style: context.texts.titleMedium,
                    textAlign: TextAlign.center),
                if (r.subject.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    [r.subject, if (r.chapter.isNotEmpty) r.chapter].join(' • '),
                    style: context.texts.bodySmall
                        ?.copyWith(color: p.mutedForeground),
                  ),
                ],
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _stat(context, '${r.score}', 'Correct', p.success),
                    _stat(context, '${r.total - r.score}', 'Wrong',
                        p.destructive),
                    _stat(context, '${r.total}', 'Total', p.foreground),
                  ],
                ),
              ],
            ),
          ),
          if (r.questionResults.isNotEmpty) ...[
            const SizedBox(height: 24),
            const SectionHeader(title: 'Answer review'),
            const SizedBox(height: 12),
            ...r.questionResults.asMap().entries.map(
                (e) => _reviewCard(context, e.key, e.value)),
          ],
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Back to Test Center',
            onPressed: () => context.go('/tests'),
          ),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String value, String label, Color color) {
    return Column(
      children: [
        Text(value,
            style: context.texts.headlineSmall?.copyWith(color: color)),
        Text(label,
            style: context.texts.bodySmall
                ?.copyWith(color: context.palette.mutedForeground)),
      ],
    );
  }

  Widget _reviewCard(BuildContext context, int i, QuestionResult q) {
    final p = context.palette;
    final c = q.isCorrect ? p.success : p.destructive;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                    q.isCorrect
                        ? Icons.check_circle_rounded
                        : Icons.cancel_rounded,
                    color: c,
                    size: 18),
                const SizedBox(width: 8),
                Text('Question ${i + 1}',
                    style: context.texts.labelMedium?.copyWith(color: c)),
              ],
            ),
            const SizedBox(height: 8),
            Text(q.question, style: context.texts.bodyMedium),
            if (q.explanation != null && q.explanation!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: p.muted,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(q.explanation!,
                    style: context.texts.bodySmall
                        ?.copyWith(color: p.mutedForeground)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _message(double pct) {
    if (pct >= 90) return 'Outstanding performance! 🎉';
    if (pct >= 80) return 'Great job — keep it up! ⭐';
    if (pct >= 70) return 'Good work, a little more effort! 💪';
    if (pct >= 50) return 'Fair — review and try again! 📚';
    return 'Keep practicing, you\'ve got this! 🔥';
  }
}
