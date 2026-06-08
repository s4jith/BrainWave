import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/assessment_model.dart';
import 'assessment_provider.dart';

/// Mobile entry point for assessments: "Available" to attempt and "Results"
/// for past submissions. (The web reaches the taker from course content; this
/// list ensures every assessment has an entry point on mobile.)
class AssessmentsListScreen extends ConsumerWidget {
  const AssessmentsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Assessments'),
          bottom: const TabBar(
            tabs: [Tab(text: 'Available'), Tab(text: 'Results')],
          ),
        ),
        body: TabBarView(
          children: [_available(context, ref), _results(context, ref)],
        ),
      ),
    );
  }

  Widget _available(BuildContext context, WidgetRef ref) {
    final list = ref.watch(assessmentsListProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(assessmentsListProvider.future),
      child: list.when(
        loading: () => const LoadingView(message: 'Loading assessments…'),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 120),
          ErrorView(message: '$e', onRetry: () => ref.invalidate(assessmentsListProvider)),
        ]),
        data: (items) {
          if (items.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 120),
              EmptyState(
                icon: Icons.assignment_outlined,
                title: 'No assessments',
                message: 'Assessments assigned to you will appear here.',
              ),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _availableCard(context, items[i]),
          );
        },
      ),
    );
  }

  Widget _availableCard(BuildContext context, AssessmentSummary a) {
    final p = context.palette;
    final canAttempt = (a.attemptsRemaining ?? 1) > 0;
    return AppCard(
      onTap: canAttempt ? () => context.push('/assessment/${a.id}') : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(label: a.type.toUpperCase(), color: p.info),
              const Spacer(),
              if (a.hasAttempted)
                StatusBadge(
                    label: 'Attempted',
                    color: p.success,
                    icon: Icons.check_circle_outline_rounded),
            ],
          ),
          const SizedBox(height: 10),
          Text(a.title, style: context.texts.titleSmall),
          if (a.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(a.description,
                style: context.texts.bodySmall
                    ?.copyWith(color: p.mutedForeground),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _meta(context, Icons.help_outline_rounded,
                  '${a.questionCount} questions'),
              const SizedBox(width: 14),
              _meta(context, Icons.star_outline_rounded, '${a.totalPoints} pts'),
              if (a.timeLimitMinutes != null) ...[
                const SizedBox(width: 14),
                _meta(context, Icons.timer_outlined, '${a.timeLimitMinutes} min'),
              ],
            ],
          ),
          if (a.dueDate != null) ...[
            const SizedBox(height: 8),
            Text('Due ${Formatters.date(a.dueDate)}',
                style: context.texts.labelSmall
                    ?.copyWith(color: p.mutedForeground)),
          ],
        ],
      ),
    );
  }

  Widget _results(BuildContext context, WidgetRef ref) {
    final subs = ref.watch(mySubmissionsProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(mySubmissionsProvider.future),
      child: subs.when(
        loading: () => const LoadingView(message: 'Loading results…'),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 120),
          ErrorView(message: '$e', onRetry: () => ref.invalidate(mySubmissionsProvider)),
        ]),
        data: (items) {
          if (items.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 120),
              EmptyState(
                icon: Icons.assignment_turned_in_outlined,
                title: 'No results yet',
                message: 'Submit an assessment to see your results here.',
              ),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _resultCard(context, items[i]),
          );
        },
      ),
    );
  }

  Widget _resultCard(BuildContext context, AssessmentSubmission s) {
    final p = context.palette;
    final graded = s.isGraded;
    final color = !graded
        ? p.warning
        : s.passed
            ? p.success
            : p.destructive;
    return AppCard(
      onTap: () => context.push('/assessment-result', extra: s.id),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: graded
                ? Text('${s.percentage.round()}%',
                    style: context.texts.labelLarge?.copyWith(color: color))
                : Icon(Icons.hourglass_top_rounded, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Attempt ${s.attemptNumber}',
                    style: context.texts.titleSmall),
                const SizedBox(height: 4),
                Text(
                  graded
                      ? '${s.totalScore}/${s.maxScore} • ${s.passed ? 'Passed' : 'Not passed'}'
                      : 'Awaiting grading',
                  style: context.texts.bodySmall
                      ?.copyWith(color: p.mutedForeground),
                ),
              ],
            ),
          ),
          Text(Formatters.date(s.submittedAt),
              style: context.texts.labelSmall
                  ?.copyWith(color: p.mutedForeground)),
        ],
      ),
    );
  }

  Widget _meta(BuildContext context, IconData icon, String text) {
    final p = context.palette;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: p.mutedForeground),
        const SizedBox(width: 4),
        Text(text,
            style: context.texts.labelSmall?.copyWith(color: p.mutedForeground)),
      ],
    );
  }
}
