import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/dashboard_model.dart';
import '../providers/auth_provider.dart';
import '../providers/student_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final dash = ref.watch(dashboardProvider);
    final firstName = (user?.name.trim().split(' ').first ?? 'Student');

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              _header(context, firstName, user?.initials ?? 'S'),
              const SizedBox(height: 20),
              _stats(context, dash, () => ref.invalidate(dashboardProvider)),
              const SizedBox(height: 24),
              const SectionHeader(title: 'Quick actions'),
              const SizedBox(height: 12),
              _quickActions(context),
              if ((user?.subjects ?? []).isNotEmpty) ...[
                const SizedBox(height: 24),
                const SectionHeader(title: 'Your subjects'),
                const SizedBox(height: 12),
                _subjects(context, user!.subjects),
              ],
              const SizedBox(height: 24),
              _recentNotes(context, dash),
              const SizedBox(height: 24),
              const SectionHeader(title: 'Explore'),
              const SizedBox(height: 12),
              _exploreGrid(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context, String name, String initials) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(greeting,
                  style: context.texts.bodyMedium
                      ?.copyWith(color: context.palette.mutedForeground)),
              const SizedBox(height: 2),
              Text(name, style: context.texts.headlineMedium),
            ],
          ),
        ),
        AppAvatar(
          initials: initials,
          onTap: () => context.go('/settings'),
        ),
      ],
    );
  }

  Widget _stats(BuildContext context, AsyncValue<DashboardModel> dash,
      VoidCallback retry) {
    return dash.when(
      loading: () => const Row(
        children: [
          Expanded(child: ShimmerBox(height: 96, radius: AppRadius.lg)),
          SizedBox(width: 12),
          Expanded(child: ShimmerBox(height: 96, radius: AppRadius.lg)),
          SizedBox(width: 12),
          Expanded(child: ShimmerBox(height: 96, radius: AppRadius.lg)),
        ],
      ),
      error: (e, _) => AppCard(
        child: Row(
          children: [
            Icon(Icons.error_outline_rounded,
                color: context.palette.destructive, size: 20),
            const SizedBox(width: 10),
            Expanded(
                child: Text(e is ApiException ? e.message : 'Failed to load',
                    style: context.texts.bodySmall)),
            TextButton(onPressed: retry, child: const Text('Retry')),
          ],
        ),
      ),
      data: (d) {
        return Column(
          children: [
            Row(
              children: [
                _statCard(context, Icons.local_fire_department_rounded,
                    '${d.streak.currentStreak}', 'Day streak'),
                const SizedBox(width: 12),
                _statCard(context, Icons.workspace_premium_rounded,
                    Formatters.percent(d.progress.averageScore), 'Avg score'),
                const SizedBox(width: 12),
                _statCard(context, Icons.fact_check_rounded,
                    '${d.progress.completedTests}', 'Tests done'),
              ],
            ),
            const SizedBox(height: 12),
            _progressCard(context, d.progress),
          ],
        );
      },
    );
  }

  Widget _statCard(
      BuildContext context, IconData icon, String value, String label) {
    final p = context.palette;
    return Expanded(
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
        child: Column(
          children: [
            Icon(icon, size: 24, color: p.foreground),
            const SizedBox(height: 8),
            Text(value,
                style: context.texts.titleLarge,
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(label,
                style: context.texts.bodySmall
                    ?.copyWith(color: p.mutedForeground),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _progressCard(BuildContext context, ProgressData progress) {
    final p = context.palette;
    final value = (progress.overallProgress.clamp(0, 100)) / 100;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text('Overall progress',
                      style: context.texts.titleSmall)),
              Text('${progress.overallProgress}%',
                  style: context.texts.titleSmall),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: value,
              minHeight: 8,
              backgroundColor: p.muted,
              valueColor: AlwaysStoppedAnimation(p.primary),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${progress.completedChapters}/${progress.totalChapters} chapters • ${progress.completedTests}/${progress.totalTests} tests',
            style: context.texts.bodySmall?.copyWith(color: p.mutedForeground),
          ),
        ],
      ),
    );
  }

  Widget _quickActions(BuildContext context) {
    return Row(
      children: [
        _action(context, Icons.smart_toy_rounded, 'Ask AI',
            () => context.push('/ai-chat')),
        const SizedBox(width: 10),
        _action(context, Icons.menu_book_rounded, 'Read & learn',
            () => context.go('/learn')),
        const SizedBox(width: 10),
        _action(context, Icons.note_alt_rounded, 'My notes',
            () => context.go('/notes')),
      ],
    );
  }

  Widget _action(
      BuildContext context, IconData icon, String label, VoidCallback onTap) {
    final p = context.palette;
    return Expanded(
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Column(
          children: [
            Icon(icon, size: 26, color: p.foreground),
            const SizedBox(height: 8),
            Text(label,
                style: context.texts.labelMedium,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  Widget _subjects(BuildContext context, List<String> subjects) {
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: subjects.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final s = subjects[i];
          return GestureDetector(
            onTap: () => context.go('/learn'),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: 76,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(Formatters.subjectEmoji(s),
                        style: const TextStyle(fontSize: 22)),
                    const SizedBox(height: 6),
                    Text(s,
                        style: context.texts.labelSmall
                            ?.copyWith(color: context.palette.foreground),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _recentNotes(BuildContext context, AsyncValue<DashboardModel> dash) {
    final notes = dash.asData?.value.recentNotes ?? const <NoteSummary>[];
    if (dash.isLoading) {
      return const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: 'Recent notes'),
          SizedBox(height: 12),
          ShimmerBox(height: 64, radius: AppRadius.lg),
        ],
      );
    }
    if (notes.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
            title: 'Recent notes',
            actionLabel: 'See all',
            onAction: () => context.go('/notes')),
        const SizedBox(height: 12),
        ...notes.take(3).map((n) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                onTap: () => context.go('/notes'),
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Text(Formatters.subjectEmoji(n.subject),
                        style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(n.title,
                              style: context.texts.titleSmall,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                          Text(n.lesson,
                              style: context.texts.bodySmall?.copyWith(
                                  color: context.palette.mutedForeground),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    Text(n.date,
                        style: context.texts.labelSmall
                            ?.copyWith(color: context.palette.mutedForeground)),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _exploreGrid(BuildContext context) {
    final items = <({IconData icon, String label, String route})>[
      (icon: Icons.assignment_turned_in_outlined, label: 'Assessments', route: '/assessments'),
      (icon: Icons.insights_outlined, label: 'Report card', route: '/report-card'),
      (icon: Icons.grade_outlined, label: 'Gradebook', route: '/gradebook'),
      (icon: Icons.groups_outlined, label: 'My groups', route: '/groups'),
      (icon: Icons.forum_outlined, label: 'My queries', route: '/queries'),
      (icon: Icons.work_outline_rounded, label: 'Career test', route: '/career'),
      (icon: Icons.support_agent_outlined, label: 'Support', route: '/support'),
      (icon: Icons.lightbulb_outline_rounded, label: 'Suggestions', route: '/suggestions'),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.98,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item = items[i];
        final p = context.palette;
        return AppCard(
          onTap: () => context.push(item.route),
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration:
                    BoxDecoration(color: p.muted, shape: BoxShape.circle),
                child: Icon(item.icon, size: 21, color: p.foreground),
              ),
              const SizedBox(height: 8),
              Text(item.label,
                  style: context.texts.labelSmall
                      ?.copyWith(color: p.foreground),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        );
      },
    );
  }
}
