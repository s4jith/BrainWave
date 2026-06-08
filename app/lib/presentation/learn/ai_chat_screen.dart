import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../providers/auth_provider.dart';
import 'learn_providers.dart';
import 'widgets/chat_view.dart';

/// Standalone AI chat (the `/ai-chat` route) — subject/chapter are chosen in the
/// composer rather than locked to an open lesson.
class AiChatScreen extends ConsumerWidget {
  const AiChatScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final classLevel = (user?.classLevelInt ?? 10).toString();
    final subjects =
        user != null && user.subjects.isNotEmpty ? user.subjects : AppConstants.subjects;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Study Buddy'),
        actions: [
          IconButton(
            tooltip: 'Clear chat',
            onPressed: () =>
                ref.read(chatControllerProvider('general').notifier).reset(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: ChatView(
        scope: 'general',
        classLevel: classLevel,
        subjectOptions: subjects,
      ),
    );
  }
}
