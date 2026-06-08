import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/support_model.dart';
import 'support_provider.dart';

class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  static const categories = ['general', 'technical', 'content', 'account', 'other'];
  static const priorities = ['low', 'medium', 'high', 'urgent'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tickets = ref.watch(supportTicketsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _create(context, ref),
        backgroundColor: context.palette.primary,
        foregroundColor: context.palette.primaryForeground,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New ticket'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(supportTicketsProvider.future),
        child: tickets.when(
          loading: () => const LoadingView(message: 'Loading tickets…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(supportTicketsProvider)),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 100),
                EmptyState(
                  icon: Icons.support_agent_outlined,
                  title: 'No tickets',
                  message: 'Need help? Raise a ticket and our team will respond.',
                  actionLabel: 'New ticket',
                  onAction: () => _create(context, ref),
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

  Widget _card(BuildContext context, SupportTicket t) {
    final p = context.palette;
    return AppCard(
      onTap: () => context.push('/support-ticket', extra: t.id),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (t.ticketNumber.isNotEmpty)
                Text(t.ticketNumber,
                    style: context.texts.labelSmall
                        ?.copyWith(color: p.mutedForeground)),
              const Spacer(),
              StatusBadge(
                  label: t.status.replaceAll('_', ' '),
                  color: _statusColor(context, t.status)),
            ],
          ),
          const SizedBox(height: 8),
          Text(t.title,
              style: context.texts.titleSmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(t.description,
              style: context.texts.bodySmall?.copyWith(color: p.mutedForeground),
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 10),
          Row(
            children: [
              StatusBadge(
                  label: t.priority, color: _priorityColor(context, t.priority)),
              const Spacer(),
              if (t.replies.isNotEmpty) ...[
                Icon(Icons.forum_outlined,
                    size: 14, color: p.mutedForeground),
                const SizedBox(width: 4),
                Text('${t.replies.length}',
                    style: context.texts.labelSmall
                        ?.copyWith(color: p.mutedForeground)),
                const SizedBox(width: 10),
              ],
              Text(Formatters.relative(t.updatedAt ?? t.createdAt),
                  style: context.texts.labelSmall
                      ?.copyWith(color: p.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final draft = await showModalBottomSheet<_TicketDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      builder: (_) => const _TicketSheet(),
    );
    if (draft == null) return;
    try {
      await ref.read(supportTicketsProvider.notifier).create(
            title: draft.title,
            description: draft.description,
            category: draft.category,
            priority: draft.priority,
          );
      if (context.mounted) context.showSnack('Ticket created');
    } catch (e) {
      if (context.mounted) context.showSnack('$e', isError: true);
    }
  }

  static Color _statusColor(BuildContext context, String status) {
    final p = context.palette;
    switch (status) {
      case 'resolved':
      case 'closed':
        return p.success;
      case 'in_progress':
        return p.info;
      default:
        return p.warning;
    }
  }

  static Color _priorityColor(BuildContext context, String priority) {
    final p = context.palette;
    switch (priority) {
      case 'urgent':
      case 'high':
        return p.destructive;
      case 'low':
        return p.mutedForeground;
      default:
        return p.info;
    }
  }
}

class _TicketDraft {
  final String title;
  final String description;
  final String category;
  final String priority;
  const _TicketDraft(
      this.title, this.description, this.category, this.priority);
}

class _TicketSheet extends StatefulWidget {
  const _TicketSheet();

  @override
  State<_TicketSheet> createState() => _TicketSheetState();
}

class _TicketSheetState extends State<_TicketSheet> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _category = SupportScreen.categories.first;
  String _priority = 'medium';

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _titleCtrl.text.trim();
    final desc = _descCtrl.text.trim();
    if (title.length < 5) {
      context.showSnack('Title must be at least 5 characters.', isError: true);
      return;
    }
    if (desc.length < 10) {
      context.showSnack('Please describe your issue (10+ characters).',
          isError: true);
      return;
    }
    Navigator.of(context).pop(_TicketDraft(title, desc, _category, _priority));
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('New support ticket', style: context.texts.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _titleCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                  labelText: 'Describe your issue', alignLabelWithHint: true),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _category,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: SupportScreen.categories
                        .map((c) => DropdownMenuItem(
                            value: c,
                            child: Text(c[0].toUpperCase() + c.substring(1))))
                        .toList(),
                    onChanged: (v) => setState(() => _category = v ?? _category),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _priority,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Priority'),
                    items: SupportScreen.priorities
                        .map((c) => DropdownMenuItem(
                            value: c,
                            child: Text(c[0].toUpperCase() + c.substring(1))))
                        .toList(),
                    onChanged: (v) => setState(() => _priority = v ?? _priority),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            PrimaryButton(label: 'Create ticket', onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
