import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/grade_model.dart';
import 'gradebook_provider.dart';

class GradebookScreen extends ConsumerWidget {
  const GradebookScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final grades = ref.watch(gradebookProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Gradebook')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(gradebookProvider.future),
        child: grades.when(
          loading: () => const LoadingView(message: 'Loading grades…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(message: '$e', onRetry: () => ref.invalidate(gradebookProvider)),
          ]),
          data: (data) {
            if (data.grades.isEmpty && data.overallPercentage == 0) {
              return ListView(children: const [
                SizedBox(height: 120),
                EmptyState(
                  icon: Icons.grade_outlined,
                  title: 'No grades yet',
                  message:
                      'Your grades will appear here once your assessments are graded.',
                ),
              ]);
            }
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _overall(context, data.overallPercentage, data.overallLetter),
                if (data.grades.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const SectionHeader(title: 'By course'),
                  const SizedBox(height: 12),
                  ...data.grades.map((g) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _gradeCard(context, g),
                      )),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _overall(BuildContext context, double pct, String letter) {
    final p = context.palette;
    final color = pct >= 80
        ? p.success
        : pct >= 50
            ? p.warning
            : (pct > 0 ? p.destructive : p.mutedForeground);
    return AppCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          CircularPercentIndicator(
            radius: 64,
            lineWidth: 11,
            percent: (pct / 100).clamp(0, 1),
            circularStrokeCap: CircularStrokeCap.round,
            progressColor: color,
            backgroundColor: p.muted,
            center: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(Formatters.percent(pct),
                    style: context.texts.headlineMedium?.copyWith(color: color)),
                Text(letter,
                    style: context.texts.titleMedium?.copyWith(color: color)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text('Overall grade', style: context.texts.titleSmall),
        ],
      ),
    );
  }

  Widget _gradeCard(BuildContext context, GradeModel g) {
    final p = context.palette;
    final color = g.percentage >= 80
        ? p.success
        : g.percentage >= 50
            ? p.warning
            : (g.percentage > 0 ? p.destructive : p.mutedForeground);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(g.courseName,
                    style: context.texts.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
              Text(g.letterGrade,
                  style: context.texts.titleMedium?.copyWith(color: color)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: (g.percentage / 100).clamp(0, 1),
              minHeight: 7,
              backgroundColor: p.muted,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(Formatters.percent(g.percentage),
                  style: context.texts.labelMedium),
              if (g.totalAssignments > 0)
                Text('${g.completedAssignments}/${g.totalAssignments} graded',
                    style: context.texts.bodySmall
                        ?.copyWith(color: p.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }
}
