import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/chat_service.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isSending = false;
  String _selectedMode = 'Simple';
  String? _selectedSubject;
  String? _selectedChapter;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    if (user?.subjects.isNotEmpty == true) {
      _selectedSubject = user!.subjects.first;
    }
    _messages.add(ChatMessage(
      role: 'assistant',
      content: "Hi! I'm your AI study assistant. Ask me anything about your subjects, and I'll explain it in the way that works best for you. 🎓",
      timestamp: DateTime.now(),
    ));
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _isSending) return;
    final user = ref.read(authProvider).user;

    setState(() {
      _messages.add(ChatMessage(role: 'user', content: text, timestamp: DateTime.now()));
      _isSending = true;
      _msgCtrl.clear();
    });
    _scrollToBottom();

    try {
      final reply = await ref.read(chatServiceProvider).studentChat(
        question: text,
        classLevel: user?.classLevel ?? 'Class 9',
        subject: _selectedSubject ?? 'Science',
        chapter: _selectedChapter ?? '',
        mode: _selectedMode,
      );
      if (mounted) {
        setState(() => _messages.add(
          ChatMessage(role: 'assistant', content: reply, timestamp: DateTime.now()),
        ));
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _messages.add(ChatMessage(
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: DateTime.now(),
        )));
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Study Assistant'),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune),
            onPressed: _showSettingsSheet,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildContextBar(user),
          _buildModeSelector(),
          Expanded(child: _buildMessageList()),
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildContextBar(user) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        border: Border(bottom: BorderSide(color: AppTheme.borderDark)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildDropdown(
              value: _selectedSubject,
              items: user?.subjects ?? AppConstants.subjects,
              hint: 'Subject',
              onChanged: (v) => setState(() => _selectedSubject = v),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              onChanged: (v) => setState(() => _selectedChapter = v),
              decoration: const InputDecoration(
                hintText: 'Chapter (optional)',
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                isDense: true,
              ),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textPrimaryDark),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdown({
    required String? value,
    required List<String> items,
    required String hint,
    required ValueChanged<String?> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      hint: Text(hint, style: Theme.of(context).textTheme.bodySmall),
      items: items.map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
      onChanged: onChanged,
      dropdownColor: AppTheme.surfaceDark,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textPrimaryDark),
    );
  }

  Widget _buildModeSelector() {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        itemCount: AppConstants.chatModes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final mode = AppConstants.chatModes[i];
          final isSelected = _selectedMode == mode;
          return GestureDetector(
            onTap: () => setState(() => _selectedMode = mode),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.primary : AppTheme.cardDark,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? AppTheme.primary : AppTheme.borderDark,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(AppConstants.chatModeIcons[mode] ?? ''),
                  const SizedBox(width: 4),
                  Text(
                    mode,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isSelected ? Colors.white : AppTheme.textSecondaryDark,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMessageList() {
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _messages.length + (_isSending ? 1 : 0),
      itemBuilder: (_, i) {
        if (i == _messages.length) return _buildTypingIndicator();
        return _buildMessageBubble(_messages[i]);
      },
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    final isUser = msg.role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUser ? AppTheme.primary : AppTheme.cardDark,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
          border: isUser ? null : Border.all(color: AppTheme.borderDark),
        ),
        child: isUser
            ? Text(msg.content, style: const TextStyle(color: Colors.white))
            : MarkdownBody(
                data: msg.content,
                styleSheet: MarkdownStyleSheet(
                  p: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textPrimaryDark),
                  code: TextStyle(
                    backgroundColor: AppTheme.surfaceDark,
                    color: AppTheme.accent,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.cardDark,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderDark),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(width: 4),
            _buildDot(0),
            const SizedBox(width: 4),
            _buildDot(1),
            const SizedBox(width: 4),
            _buildDot(2),
          ],
        ),
      ),
    );
  }

  Widget _buildDot(int index) {
    return TweenAnimationBuilder(
      tween: Tween<double>(begin: 0, end: 1),
      duration: Duration(milliseconds: 600 + index * 200),
      builder: (_, value, __) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppTheme.primary.withOpacity(0.4 + value * 0.6),
          ),
        );
      },
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        border: Border(top: BorderSide(color: AppTheme.borderDark)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _msgCtrl,
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(
                hintText: 'Ask anything...',
                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _sendMessage,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: _isSending ? null : AppTheme.primaryGradient,
                color: _isSending ? AppTheme.borderDark : null,
                shape: BoxShape.circle,
              ),
              child: _isSending
                  ? const Center(
                      child: SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  void _showSettingsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Chat Mode', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            ...AppConstants.chatModes.map((mode) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text(AppConstants.chatModeIcons[mode] ?? '', style: const TextStyle(fontSize: 24)),
              title: Text(mode, style: Theme.of(context).textTheme.bodyLarge),
              subtitle: Text(AppConstants.chatModeDescriptions[mode] ?? '', style: Theme.of(context).textTheme.bodySmall),
              trailing: _selectedMode == mode ? const Icon(Icons.check_circle, color: AppTheme.primary) : null,
              onTap: () {
                setState(() => _selectedMode = mode);
                Navigator.pop(context);
              },
            )),
          ],
        ),
      ),
    );
  }
}
