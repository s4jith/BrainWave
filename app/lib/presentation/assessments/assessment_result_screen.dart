import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/assessment_model.dart';
import 'assessment_provider.dart';

class AssessmentResultScreen extends ConsumerWidget {
  final String submissionId;
  const AssessmentResultScreen({super.key, required this.submissionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(submissionDetailProvider(submissionId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Assessment result'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () => context.go('/assessments'),
            child: const Text('Done'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingView(message: 'Loading result…'),
        error: (e, _) => ErrorView(
          message: e is ApiException ? e.message : 'Could not load result.',
          onRetry: () => ref.invalidate(submissionDetailProvider(submissionId)),
        ),
        data: (s) => _content(context, s),
      ),
    );
  }

  Widget _content(BuildContext context, SubmissionDetail s) {
    final p = context.palette;
    final graded = s.isGraded;
    final color = !graded
        ? p.warning
        : s.passed
            ? p.success
            : p.destructive;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        AppCard(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              if (graded)
                CircularPercentIndicator(
                  radius: 66,
                  lineWidth: 11,
                  percent: (s.percentage / 100).clamp(0, 1),
                  circularStrokeCap: CircularStrokeCap.round,
                  progressColor: color,
                  backgroundColor: p.muted,
                  center: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${s.percentage.round()}%',
                          style: context.texts.headlineMedium
                              ?.copyWith(color: color)),
                      Text('${s.totalScore}/${s.maxScore}',
                          style: context.texts.bodySmall
                              ?.copyWith(color: p.mutedForeground)),
                    ],
                  ),
                )
              else
                Column(
                  children: [
                    Icon(Icons.hourglass_top_rounded, color: color, size: 56),
                    const SizedBox(height: 12),
                    Text('Awaiting grading', style: context.texts.titleMedium),
                  ],
                ),
              if (graded) ...[
                const SizedBox(height: 16),
                StatusBadge(
                  label: s.passed ? 'Passed' : 'Not passed',
                  color: color,
                  icon: s.passed
                      ? Icons.check_circle_outline_rounded
                      : Icons.cancel_outlined,
                ),
              ],
            ],
          ),
        ),
        if (s.overallFeedback?.isNotEmpty ?? false) ...[
          const SizedBox(height: 20),
          const SectionHeader(title: 'Feedback'),
          const SizedBox(height: 12),
          AppCard(
            child: Text(s.overallFeedback!,
                style: context.texts.bodyMedium
                    ?.copyWith(color: p.mutedForeground, height: 1.5)),
          ),
        ],
        if (s.adminComment?.isNotEmpty ?? false) ...[
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Reviewer comment',
                    style: context.texts.labelSmall
                        ?.copyWith(color: p.mutedForeground)),
                const SizedBox(height: 4),
                Text(s.adminComment!, style: context.texts.bodyMedium),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        PrimaryButton(
          label: 'Back to assessments',
          onPressed: () => context.go('/assessments'),
        ),
      ],
    );
  }
}
