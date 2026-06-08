import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/suggestion_model.dart';
import 'suggestions_provider.dart';

class SuggestionsScreen extends ConsumerWidget {
  const SuggestionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestions = ref.watch(suggestionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Suggestions')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _submit(context, ref),
        backgroundColor: context.palette.primary,
        foregroundColor: context.palette.primaryForeground,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Suggest'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(suggestionsProvider.future),
        child: suggestions.when(
          loading: () => const LoadingView(message: 'Loading…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(suggestionsProvider)),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 100),
                EmptyState(
                  icon: Icons.lightbulb_outline_rounded,
                  title: 'Share an idea',
                  message:
                      'Tell us how to make BrainWave better. Admins review every suggestion.',
                  actionLabel: 'Send a suggestion',
                  onAction: () => _submit(context, ref),
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

  Widget _card(BuildContext context, SuggestionModel s) {
    final p = context.palette;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(label: s.category.toUpperCase(), color: p.info),
              const Spacer(),
              StatusBadge(
                label: s.isReviewed ? 'Reviewed' : 'Pending',
                color: s.isReviewed ? p.success : p.warning,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(s.content, style: context.texts.bodyMedium),
          if (s.adminResponse?.isNotEmpty ?? false) ...[
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
                  Text('Admin response',
                      style: context.texts.labelSmall
                          ?.copyWith(color: p.mutedForeground)),
                  const SizedBox(height: 4),
                  Text(s.adminResponse!, style: context.texts.bodyMedium),
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(Formatters.relative(s.createdAt),
              style:
                  context.texts.labelSmall?.copyWith(color: p.mutedForeground)),
        ],
      ),
    );
  }

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final draft = await showModalBottomSheet<({String category, String content})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      builder: (_) => const _SuggestionSheet(),
    );
    if (draft == null) return;
    try {
      await ref
          .read(suggestionsProvider.notifier)
          .submit(content: draft.content, category: draft.category);
      if (context.mounted) context.showSnack('Thanks for your suggestion!');
    } catch (e) {
      if (context.mounted) context.showSnack('$e', isError: true);
    }
  }
}

class _SuggestionSheet extends StatefulWidget {
  const _SuggestionSheet();

  @override
  State<_SuggestionSheet> createState() => _SuggestionSheetState();
}

class _SuggestionSheetState extends State<_SuggestionSheet> {
  final _contentCtrl = TextEditingController();
  String _category = SuggestionModel.categories.first;

  @override
  void dispose() {
    _contentCtrl.dispose();
    super.dispose();
  }

  void _send() {
    final content = _contentCtrl.text.trim();
    if (content.isEmpty) {
      context.showSnack('Write your suggestion first.', isError: true);
      return;
    }
    Navigator.of(context).pop((category: _category, content: content));
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
          Text('Send a suggestion', style: context.texts.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _category,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Category'),
            items: SuggestionModel.categories
                .map((c) => DropdownMenuItem(
                    value: c, child: Text(c[0].toUpperCase() + c.substring(1))))
                .toList(),
            onChanged: (v) => setState(() => _category = v ?? _category),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentCtrl,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Your suggestion',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          PrimaryButton(label: 'Submit', onPressed: _send),
        ],
      ),
    );
  }
}
