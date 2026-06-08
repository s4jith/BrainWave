import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/repositories/chat_repository.dart';
import '../learn_providers.dart';

/// Reusable AI chat surface (conversation + composer) backed by
/// [chatControllerProvider]. Used by BookToBot (subject/chapter locked to the
/// open lesson) and by the standalone AI chat (subject/chapter pickers shown).
class ChatView extends ConsumerStatefulWidget {
  final String scope;
  final String classLevel;
  final String? fixedSubject;
  final String? fixedChapter;
  final List<String> subjectOptions;

  const ChatView({
    super.key,
    required this.scope,
    required this.classLevel,
    this.fixedSubject,
    this.fixedChapter,
    this.subjectOptions = const [],
  });

  @override
  ConsumerState<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends ConsumerState<ChatView> {
  final _msgCtrl = TextEditingController();
  final _chapterCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  String _mode = 'Simple';
  String? _subject;

  bool get _locked => widget.fixedSubject != null;

  @override
  void initState() {
    super.initState();
    _subject = widget.fixedSubject ??
        (widget.subjectOptions.isNotEmpty ? widget.subjectOptions.first : null);
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _chapterCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 120,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    final subject = widget.fixedSubject ?? _subject ?? '';
    if (text.isEmpty || subject.isEmpty) return;
    _msgCtrl.clear();
    FocusScope.of(context).unfocus();
    await ref.read(chatControllerProvider(widget.scope).notifier).send(
          question: text,
          classLevel: widget.classLevel,
          subject: subject,
          chapter: widget.fixedChapter ?? _chapterCtrl.text.trim(),
          mode: _mode,
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatControllerProvider(widget.scope));
    ref.listen(chatControllerProvider(widget.scope), (_, __) => _scrollToEnd());
    final p = context.palette;

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollCtrl,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            itemCount: state.messages.length + (state.sending ? 1 : 0),
            itemBuilder: (_, i) {
              if (i >= state.messages.length) return const _TypingBubble();
              return _bubble(state.messages[i]);
            },
          ),
        ),
        _composer(p, state.sending),
      ],
    );
  }

  Widget _bubble(ChatMessage m) {
    final p = context.palette;
    final isUser = m.isUser;
    final bg = isUser
        ? p.primary
        : (m.isError ? p.destructive.withValues(alpha: 0.12) : p.card);
    final fg = isUser ? p.primaryForeground : p.foreground;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.82),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: isUser ? null : Border.all(color: p.border),
        ),
        child: isUser
            ? Text(m.content, style: context.texts.bodyMedium?.copyWith(color: fg))
            : MarkdownBody(
                data: m.content,
                styleSheet: MarkdownStyleSheet(
                  p: context.texts.bodyMedium?.copyWith(
                      color: m.isError ? p.destructive : p.foreground),
                  strong: context.texts.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                  code: context.texts.bodySmall?.copyWith(
                      backgroundColor: p.muted, fontFamily: 'monospace'),
                  listBullet: context.texts.bodyMedium,
                ),
              ),
      ),
    );
  }

  Widget _composer(AppPalette p, bool sending) {
    return Container(
      decoration: BoxDecoration(
        color: p.background,
        border: Border(top: BorderSide(color: p.border)),
      ),
      padding: EdgeInsets.fromLTRB(
          12, 8, 12, 8 + MediaQuery.of(context).viewPadding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final mode in AppConstants.chatModes)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _ModeChip(
                      label: mode,
                      emoji: AppConstants.chatModeIcons[mode] ?? '💡',
                      selected: _mode == mode,
                      onTap: () => setState(() => _mode = mode),
                    ),
                  ),
              ],
            ),
          ),
          if (!_locked && widget.subjectOptions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  flex: 4,
                  child: DropdownButtonFormField<String>(
                    initialValue: _subject,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      isDense: true,
                      labelText: 'Subject',
                    ),
                    items: widget.subjectOptions
                        .map((s) =>
                            DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _subject = v),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 5,
                  child: TextField(
                    controller: _chapterCtrl,
                    decoration: const InputDecoration(
                      isDense: true,
                      labelText: 'Chapter (optional)',
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: 'Ask a question…',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _SendButton(busy: sending, onTap: _send),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  final String label;
  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  const _ModeChip({
    required this.label,
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? p.primary : p.card,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: selected ? p.primary : p.border),
        ),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 13)),
            const SizedBox(width: 6),
            Text(label,
                style: context.texts.labelMedium?.copyWith(
                    color: selected ? p.primaryForeground : p.foreground)),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  final bool busy;
  final VoidCallback onTap;
  const _SendButton({required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(color: p.primary, shape: BoxShape.circle),
        child: busy
            ? Padding(
                padding: const EdgeInsets.all(12),
                child: CircularProgressIndicator(
                    strokeWidth: 2.2, color: p.primaryForeground),
              )
            : Icon(Icons.arrow_upward_rounded, color: p.primaryForeground),
      ),
    );
  }
}

class _TypingBubble extends StatefulWidget {
  const _TypingBubble();

  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
        ..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: p.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: p.border),
        ),
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (_, __) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) {
                final t = (_ctrl.value + i * 0.2) % 1.0;
                final o = 0.3 + 0.7 * (1 - (t - 0.5).abs() * 2).clamp(0.0, 1.0);
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Opacity(
                    opacity: o,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                          color: p.mutedForeground, shape: BoxShape.circle),
                    ),
                  ),
                );
              }),
            );
          },
        ),
      ),
    );
  }
}
