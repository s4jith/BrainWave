import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/theme.dart';
import '../../models/test_model.dart';

class TestResultScreen extends StatelessWidget {
  final TestResult? result;
  const TestResultScreen({super.key, this.result});

  @override
  Widget build(BuildContext context) {
    if (result == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Result')),
        body: const Center(child: Text('No result data')),
      );
    }
    final pct = result!.percentage / 100;
    final color = result!.percentage >= 80
        ? AppTheme.success
        : result!.percentage >= 60
            ? AppTheme.warning
            : AppTheme.error;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Result'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () => context.go('/tests'),
            child: const Text('Done'),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildScoreCard(context, pct, color)),
          SliverToBoxAdapter(child: _buildReviewSection(context)),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }

  Widget _buildScoreCard(BuildContext context, double pct, Color color) {
    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          CircularPercentIndicator(
            radius: 70,
            lineWidth: 12,
            percent: pct.clamp(0, 1),
            center: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${result!.percentage.round()}%',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: color, fontWeight: FontWeight.bold,
                  ),
                ),
                Text(result!.grade, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: color)),
              ],
            ),
            progressColor: color,
            backgroundColor: color.withOpacity(0.15),
          ),
          const SizedBox(height: 20),
          Text(
            _getResultMessage(result!.percentage),
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStat(context, '${result!.score}', 'Correct', AppTheme.success),
              _buildStat(context, '${result!.total - result!.score}', 'Wrong', AppTheme.error),
              _buildStat(context, '${result!.total}', 'Total', AppTheme.primary),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStat(BuildContext context, String value, String label, Color color) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: color)),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  Widget _buildReviewSection(BuildContext context) {
    if (result!.questionResults.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Answer Review', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...result!.questionResults.asMap().entries.map((entry) {
            final i = entry.key;
            final q = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.cardDark,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: q.isCorrect ? AppTheme.success.withOpacity(0.4) : AppTheme.error.withOpacity(0.4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        q.isCorrect ? Icons.check_circle : Icons.cancel,
                        color: q.isCorrect ? AppTheme.success : AppTheme.error,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text('Q${i + 1}', style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: q.isCorrect ? AppTheme.success : AppTheme.error,
                      )),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(q.question, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textPrimaryDark,
                  )),
                  if (q.explanation != null && q.explanation!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceDark,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        q.explanation!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondaryDark),
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _getResultMessage(double pct) {
    if (pct >= 90) return 'Excellent! Outstanding performance! 🎉';
    if (pct >= 80) return 'Great job! Keep it up! ⭐';
    if (pct >= 70) return 'Good work! A little more effort! 💪';
    if (pct >= 60) return 'Fair performance. Review and retry! 📚';
    return 'Keep practicing! You can do better! 🔥';
  }
}
