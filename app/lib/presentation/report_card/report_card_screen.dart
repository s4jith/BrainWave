import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/dashboard_model.dart';
import '../providers/auth_provider.dart';
import '../providers/student_providers.dart';

class ReportCardScreen extends ConsumerWidget {
  const ReportCardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider);
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Report Card')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(progressProvider.future),
        child: progress.when(
          loading: () => const LoadingView(message: 'Building your report…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(message: '$e', onRetry: () => ref.invalidate(progressProvider)),
          ]),
          data: (d) => ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _headerCard(context, user?.name ?? 'Student',
                  user?.classLevel ?? '', d.overallProgress),
              const SizedBox(height: 20),
              const SectionHeader(title: 'Performance'),
              const SizedBox(height: 12),
              Row(
                children: [
                  _stat(context, Icons.workspace_premium_rounded,
                      Formatters.percent(d.averageScore), 'Average score'),
                  const SizedBox(width: 12),
                  _stat(context, Icons.fact_check_rounded,
                      '${d.completedTests}/${d.totalTests}', 'Tests done'),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _stat(context, Icons.menu_book_rounded,
                      '${d.completedChapters}/${d.totalChapters}', 'Chapters'),
                  const SizedBox(width: 12),
                  _stat(context, Icons.trending_up_rounded,
                      '${d.overallProgress}%', 'Completion'),
                ],
              ),
              const SizedBox(height: 20),
              _progressBreakdown(context, d),
            ],
          ),
        ),
      ),
    );
  }

  Widget _headerCard(
      BuildContext context, String name, String classLevel, int overall) {
    final p = context.palette;
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          CircularPercentIndicator(
            radius: 46,
            lineWidth: 8,
            percent: (overall.clamp(0, 100)) / 100,
            circularStrokeCap: CircularStrokeCap.round,
            progressColor: p.primary,
            backgroundColor: p.muted,
            center: Text('$overall%', style: context.texts.titleMedium),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: context.texts.titleLarge),
                if (classLevel.isNotEmpty)
                  Text(classLevel,
                      style: context.texts.bodyMedium
                          ?.copyWith(color: p.mutedForeground)),
                const SizedBox(height: 6),
                Text('Overall progress',
                    style: context.texts.bodySmall
                        ?.copyWith(color: p.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(
      BuildContext context, IconData icon, String value, String label) {
    final p = context.palette;
    return Expanded(
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: p.foreground, size: 22),
            const SizedBox(height: 10),
            Text(value, style: context.texts.titleLarge),
            Text(label,
                style: context.texts.bodySmall
                    ?.copyWith(color: p.mutedForeground)),
          ],
        ),
      ),
    );
  }

  Widget _progressBreakdown(BuildContext context, ProgressData d) {
    final p = context.palette;
    Widget bar(String label, int done, int total) {
      final v = total == 0 ? 0.0 : done / total;
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: context.texts.bodyMedium),
                Text('$done / $total',
                    style: context.texts.labelMedium
                        ?.copyWith(color: p.mutedForeground)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: v.clamp(0, 1),
                minHeight: 7,
                backgroundColor: p.muted,
                valueColor: AlwaysStoppedAnimation(p.primary),
              ),
            ),
          ],
        ),
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Progress breakdown', style: context.texts.titleSmall),
          const SizedBox(height: 14),
          bar('Tests completed', d.completedTests, d.totalTests),
          bar('Chapters completed', d.completedChapters, d.totalChapters),
        ],
      ),
    );
  }
}
