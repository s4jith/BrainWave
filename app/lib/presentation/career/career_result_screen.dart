import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/career_model.dart';
import 'career_provider.dart';

class CareerResultScreen extends ConsumerWidget {
  final String? resultId;
  const CareerResultScreen({super.key, this.resultId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = resultId;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Career Analysis'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
              onPressed: () => context.go('/dashboard'), child: const Text('Home')),
        ],
      ),
      body: id == null
          ? const EmptyState(
              icon: Icons.work_outline_rounded,
              title: 'No result',
              message: 'We could not find this career analysis.')
          : ref.watch(careerResultProvider(id)).when(
                loading: () =>
                    const LoadingView(message: 'Analysing your responses…'),
                error: (e, _) => ErrorView(
                  message:
                      e is ApiException ? e.message : 'Could not load result.',
                  onRetry: () => ref.invalidate(careerResultProvider(id)),
                ),
                data: (r) => _content(context, r),
              ),
    );
  }

  Widget _content(BuildContext context, CareerResult r) {
    final p = context.palette;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        AppCard(
          padding: const EdgeInsets.all(22),
          color: p.primary,
          child: Column(
            children: [
              Icon(Icons.workspace_premium_rounded,
                  color: p.primaryForeground, size: 44),
              const SizedBox(height: 12),
              Text('Your career matches',
                  style: context.texts.titleLarge
                      ?.copyWith(color: p.primaryForeground)),
              const SizedBox(height: 14),
              if (r.topCareers.isEmpty)
                Text('No strong matches found yet.',
                    style: context.texts.bodyMedium?.copyWith(
                        color: p.primaryForeground.withValues(alpha: 0.85)))
              else
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: r.topCareers
                      .take(6)
                      .map((c) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color:
                                  p.primaryForeground.withValues(alpha: 0.16),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.pill),
                            ),
                            child: Text(c,
                                style: context.texts.labelMedium?.copyWith(
                                    color: p.primaryForeground)),
                          ))
                      .toList(),
                ),
            ],
          ),
        ),
        if (r.analysis.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeader(title: 'Your analysis'),
          const SizedBox(height: 12),
          AppCard(
            child: Text(r.analysis,
                style: context.texts.bodyMedium
                    ?.copyWith(color: p.mutedForeground, height: 1.6)),
          ),
        ],
        if (r.strengths.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeader(title: 'Your strengths'),
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              children: r.strengths
                  .map((s) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.star_rounded,
                                color: p.warning, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                                child: Text(s,
                                    style: context.texts.bodyMedium)),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
        ],
        if (r.recommendations.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeader(title: 'Recommendations'),
          const SizedBox(height: 12),
          ...r.recommendations.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            color: p.muted, shape: BoxShape.circle),
                        child: Text('${e.key + 1}',
                            style: context.texts.labelSmall),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Text(e.value,
                              style: context.texts.bodyMedium
                                  ?.copyWith(color: p.mutedForeground))),
                    ],
                  ),
                ),
              )),
        ],
      ],
    );
  }
}
