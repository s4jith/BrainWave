import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

final chatRepositoryProvider =
    Provider<ChatRepository>((ref) => ChatRepository(ref.read(apiClientProvider)));

/// A single chat turn rendered in the AI chat / BookToBot conversation.
class ChatMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;
  final bool isError;

  const ChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
    this.isError = false,
  });

  bool get isUser => role == 'user';
}

/// RAG chatbot endpoints (`/api/chat/*`, `/api/top-questions/*`).
class ChatRepository {
  final ApiClient _client;
  ChatRepository(this._client);

  Future<String> studentChat({
    required String question,
    required String classLevel,
    required String subject,
    required String chapter,
    required String mode,
  }) async {
    final res = await _client.post('/api/chat/student', data: {
      'question': question,
      'class_level': classLevel,
      'subject': subject,
      'chapter': chapter,
      'mode': mode,
    });
    return _answer(res.data);
  }

  Future<String> imageChat({
    required String imagePath,
    required String classLevel,
    required String subject,
    required String chapter,
    required String mode,
    required String query,
  }) async {
    final form = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath),
      'class_level': classLevel,
      'subject': subject,
      'chapter': chapter,
      'mode': mode,
      'user_query': query,
    });
    final res = await _client.postFormData('/api/chat/image', form);
    return _answer(res.data);
  }

  Future<List<String>> getTopQuestions({
    required String subject,
    required String classLevel,
    String mode = 'Simple',
    int limit = 8,
  }) async {
    final res = await _client.get('/api/top-questions/top', queryParameters: {
      'subject': subject,
      'class_level': classLevel,
      'mode': mode,
      'limit': limit,
    });
    final list = Json.list(res.data, ['questions']);
    return list
        .map((e) => (e['question'] ?? e['text'] ?? '').toString())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  String _answer(dynamic data) {
    if (data is Map) {
      return (data['answer'] ?? data['response'] ?? data['text'] ?? '')
          .toString();
    }
    return data?.toString() ?? '';
  }
}
