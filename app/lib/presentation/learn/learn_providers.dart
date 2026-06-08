import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../data/models/lesson_model.dart';
import '../../data/repositories/books_repository.dart';
import '../../data/repositories/chat_repository.dart';
import '../providers/auth_provider.dart';

int _classLevel(Ref ref) => ref.read(authProvider).user?.classLevelInt ?? 10;

/// AI-ready subjects for the student's class.
final bookSubjectsProvider =
    FutureProvider.autoDispose<List<SubjectInfo>>((ref) async {
  return ref.read(booksRepositoryProvider).getSubjects(_classLevel(ref));
});

/// Currently selected subject in the Learn tab.
final selectedSubjectProvider = StateProvider.autoDispose<String?>((ref) => null);

/// Lessons for the selected subject. Re-fetches when the subject changes.
final lessonsProvider =
    FutureProvider.autoDispose<List<LessonModel>>((ref) async {
  final subject = ref.watch(selectedSubjectProvider);
  if (subject == null || subject.isEmpty) return const <LessonModel>[];
  return ref.read(booksRepositoryProvider).getLessons(
        classLevel: _classLevel(ref),
        subject: subject,
      );
});

/// Downloaded PDF bytes for a lesson, keyed by absolute URL.
final pdfBytesProvider =
    FutureProvider.autoDispose.family<Uint8List, String>((ref, url) async {
  return ref.read(booksRepositoryProvider).downloadPdf(url);
});

// ── AI chat conversation ────────────────────────────────────────────────────

class ChatState {
  final List<ChatMessage> messages;
  final bool sending;
  const ChatState({this.messages = const [], this.sending = false});

  ChatState copyWith({List<ChatMessage>? messages, bool? sending}) =>
      ChatState(
        messages: messages ?? this.messages,
        sending: sending ?? this.sending,
      );
}

/// Family keyed by scope ('book' for BookToBot, 'general' for the standalone
/// chat) so the two conversations stay independent.
final chatControllerProvider =
    NotifierProvider.family<ChatController, ChatState, String>(
        ChatController.new);

class ChatController extends FamilyNotifier<ChatState, String> {
  ChatRepository get _repo => ref.read(chatRepositoryProvider);

  @override
  ChatState build(String scope) => ChatState(messages: [_welcome()]);

  ChatMessage _welcome() => ChatMessage(
        role: 'assistant',
        content:
            "Hi! I'm your AI study buddy. Ask me anything about your subjects and I'll explain it the way that works best for you. 🎓",
        timestamp: DateTime.now(),
      );

  Future<void> send({
    required String question,
    required String classLevel,
    required String subject,
    required String chapter,
    required String mode,
  }) async {
    final text = question.trim();
    if (text.isEmpty || state.sending) return;

    state = state.copyWith(
      messages: [
        ...state.messages,
        ChatMessage(role: 'user', content: text, timestamp: DateTime.now()),
      ],
      sending: true,
    );

    try {
      final answer = await _repo.studentChat(
        question: text,
        classLevel: classLevel,
        subject: subject,
        chapter: chapter,
        mode: mode,
      );
      _append(
        answer.trim().isEmpty
            ? "I couldn't find an answer in your books for that. Try rephrasing or pick a different chapter."
            : answer,
      );
    } on ApiException catch (e) {
      _append(e.message, isError: true);
    } catch (_) {
      _append('Something went wrong. Please try again.', isError: true);
    }
  }

  void _append(String content, {bool isError = false}) {
    state = state.copyWith(
      messages: [
        ...state.messages,
        ChatMessage(
          role: 'assistant',
          content: content,
          timestamp: DateTime.now(),
          isError: isError,
        ),
      ],
      sending: false,
    );
  }

  void reset() => state = ChatState(messages: [_welcome()]);
}
