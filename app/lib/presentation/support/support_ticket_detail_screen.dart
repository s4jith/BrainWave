import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/support_model.dart';
import 'support_provider.dart';

class SupportTicketDetailScreen extends ConsumerStatefulWidget {
  final String ticketId;
  const SupportTicketDetailScreen({super.key, required this.ticketId});

  @override
  ConsumerState<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState
    extends ConsumerState<SupportTicketDetailScreen> {
  final _replyCtrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _replyCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _replyCtrl.text.trim();
    if (text.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _sending = true);
    try {
      await ref
          .read(supportTicketsProvider.notifier)
          .reply(widget.ticketId, text);
      _replyCtrl.clear();
    } catch (e) {
      if (mounted) context.showSnack('$e', isError: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticket = ref.watch(supportTicketProvider(widget.ticketId));
    return Scaffold(
      appBar: AppBar(title: const Text('Ticket')),
      body: ticket.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(supportTicketProvider(widget.ticketId)),
        ),
        data: (t) => Column(
          children: [
            Expanded(child: _thread(t)),
            _composer(t),
          ],
        ),
      ),
    );
  }

  Widget _thread(SupportTicket t) {
    final p = context.palette;
    final closed = t.status == 'closed' || t.status == 'resolved';
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            if (t.ticketNumber.isNotEmpty)
              Text(t.ticketNumber,
                  style: context.texts.labelMedium
                      ?.copyWith(color: p.mutedForeground)),
            const Spacer(),
            StatusBadge(
                label: t.status.replaceAll('_', ' '),
                color: closed ? p.success : p.warning),
          ],
        ),
        const SizedBox(height: 10),
        Text(t.title, style: context.texts.titleLarge),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.createdByName,
                  style: context.texts.labelMedium),
              const SizedBox(height: 6),
              Text(t.description, style: context.texts.bodyMedium),
              const SizedBox(height: 8),
              Text(Formatters.dateTime(t.createdAt),
                  style: context.texts.labelSmall
                      ?.copyWith(color: p.mutedForeground)),
            ],
          ),
        ),
        if (t.replies.isNotEmpty) ...[
          const SizedBox(height: 16),
          const SectionHeader(title: 'Replies'),
          const SizedBox(height: 10),
          ...t.replies.map((r) => _replyBubble(r)),
        ],
      ],
    );
  }

  Widget _replyBubble(SupportReply r) {
    final p = context.palette;
    final isAdmin = r.isAdmin;
    return Align(
      alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: isAdmin ? p.card : p.primary,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: isAdmin ? Border.all(color: p.border) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(r.authorName,
                style: context.texts.labelSmall?.copyWith(
                    color: isAdmin ? p.mutedForeground : p.primaryForeground
                        .withValues(alpha: 0.8))),
            const SizedBox(height: 4),
            Text(r.message,
                style: context.texts.bodyMedium?.copyWith(
                    color: isAdmin ? p.foreground : p.primaryForeground)),
            if (r.createdAt != null) ...[
              const SizedBox(height: 4),
              Text(Formatters.relative(r.createdAt),
                  style: context.texts.labelSmall?.copyWith(
                      color: isAdmin
                          ? p.mutedForeground
                          : p.primaryForeground.withValues(alpha: 0.7))),
            ],
          ],
        ),
      ),
    );
  }

  Widget _composer(SupportTicket t) {
    final p = context.palette;
    if (t.status == 'closed') {
      return Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, 12 + MediaQuery.of(context).viewPadding.bottom),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: p.border)),
        ),
        child: Text('This ticket is closed.',
            textAlign: TextAlign.center,
            style: context.texts.bodySmall
                ?.copyWith(color: p.mutedForeground)),
      );
    }
    return Container(
      decoration: BoxDecoration(
        color: p.background,
        border: Border(top: BorderSide(color: p.border)),
      ),
      padding: EdgeInsets.fromLTRB(
          12, 8, 12, 8 + MediaQuery.of(context).viewPadding.bottom),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _replyCtrl,
              minLines: 1,
              maxLines: 4,
              decoration: const InputDecoration(
                  hintText: 'Write a reply…', isDense: true),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _sending ? null : _send,
            child: Container(
              width: 44,
              height: 44,
              decoration:
                  BoxDecoration(color: p.primary, shape: BoxShape.circle),
              child: _sending
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: p.primaryForeground),
                    )
                  : Icon(Icons.send_rounded, color: p.primaryForeground, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
