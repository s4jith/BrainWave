import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/query_model.dart';
import '../providers/auth_provider.dart';
import 'queries_provider.dart';

class QueriesScreen extends ConsumerWidget {
  const QueriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queries = ref.watch(queriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Queries')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _ask(context, ref),
        backgroundColor: context.palette.primary,
        foregroundColor: context.palette.primaryForeground,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Ask'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(queriesProvider.future),
        child: queries.when(
          loading: () => const LoadingView(message: 'Loading queries…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(message: '$e', onRetry: () => ref.invalidate(queriesProvider)),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 100),
                EmptyState(
                  icon: Icons.forum_outlined,
                  title: 'No questions yet',
                  message: 'Ask your teachers anything about your subjects.',
                  actionLabel: 'Ask a question',
                  onAction: () => _ask(context, ref),
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 92),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _card(context, list[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _card(BuildContext context, QueryModel q) {
    final p = context.palette;
    final answered = q.isAnswered;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (q.subject.isNotEmpty)
                StatusBadge(label: q.subject, color: p.info),
              const Spacer(),
              StatusBadge(
                label: answered ? 'Answered' : 'Pending',
                color: answered ? p.success : p.warning,
                icon: answered
                    ? Icons.check_circle_outline_rounded
                    : Icons.schedule_rounded,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(q.question, style: context.texts.titleSmall),
          if (answered && (q.answer?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: p.muted,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(q.answer!, style: context.texts.bodyMedium),
                  if (q.answeredBy != null) ...[
                    const SizedBox(height: 6),
                    Text('— ${q.answeredBy}',
                        style: context.texts.labelSmall
                            ?.copyWith(color: p.mutedForeground)),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(Formatters.relative(q.createdAt),
              style:
                  context.texts.labelSmall?.copyWith(color: p.mutedForeground)),
        ],
      ),
    );
  }

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    final user = ref.read(authProvider).user;
    final subjects =
        (user?.subjects.isNotEmpty ?? false) ? user!.subjects : AppConstants.subjects;
    final draft = await showModalBottomSheet<({String subject, String question})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      builder: (_) => _AskSheet(subjects: subjects),
    );
    if (draft == null) return;
    try {
      await ref
          .read(queriesProvider.notifier)
          .ask(question: draft.question, subject: draft.subject);
      if (context.mounted) context.showSnack('Question sent to your teacher');
    } catch (e) {
      if (context.mounted) context.showSnack('$e', isError: true);
    }
  }
}

class _AskSheet extends StatefulWidget {
  final List<String> subjects;
  const _AskSheet({required this.subjects});

  @override
  State<_AskSheet> createState() => _AskSheetState();
}

class _AskSheetState extends State<_AskSheet> {
  final _questionCtrl = TextEditingController();
  late String _subject = widget.subjects.first;

  @override
  void dispose() {
    _questionCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final q = _questionCtrl.text.trim();
    if (q.isEmpty) {
      context.showSnack('Type your question first.', isError: true);
      return;
    }
    Navigator.of(context).pop((subject: _subject, question: q));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Ask a question', style: context.texts.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _subject,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Subject'),
            items: widget.subjects
                .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                .toList(),
            onChanged: (v) => setState(() => _subject = v ?? _subject),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _questionCtrl,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Your question',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          PrimaryButton(label: 'Send question', onPressed: _submit),
        ],
      ),
    );
  }
}
