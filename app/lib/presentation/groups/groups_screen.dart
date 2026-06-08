import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import 'groups_provider.dart';

class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(groupsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Groups')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(groupsProvider.future),
        child: groups.when(
          loading: () => const LoadingView(message: 'Loading groups…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(message: '$e', onRetry: () => ref.invalidate(groupsProvider)),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                EmptyState(
                  icon: Icons.groups_outlined,
                  title: 'No groups yet',
                  message: 'Your teacher will add you to class groups here.',
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final g = list[i];
                final p = context.palette;
                return AppCard(
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            color: p.muted, shape: BoxShape.circle),
                        child: Text(
                            g.subject.isNotEmpty
                                ? Formatters.subjectEmoji(g.subject)
                                : '👥',
                            style: const TextStyle(fontSize: 20)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.name, style: context.texts.titleSmall),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (g.subject.isNotEmpty) g.subject,
                                if (g.teacherName.isNotEmpty) g.teacherName,
                              ].join(' • '),
                              style: context.texts.bodySmall
                                  ?.copyWith(color: p.mutedForeground),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      if (g.studentCount > 0)
                        StatusBadge(
                            label: '${g.studentCount}', color: p.info,
                            icon: Icons.person_outline_rounded),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
