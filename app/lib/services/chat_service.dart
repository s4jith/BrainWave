import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'api_client.dart';

final chatServiceProvider = Provider((ref) => ChatService(ref.read(apiClientProvider)));

class ChatMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;

  const ChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
  });
}

class ChatService {
  final ApiClient _client;
  ChatService(this._client);

  Future<String> studentChat({
    required String question,
    required String classLevel,
    required String subject,
    required String chapter,
    required String mode,
  }) async {
    final response = await _client.post(
      '/api/chat/student',
      data: {
        'question': question,
        'class_level': classLevel,
        'subject': subject,
        'chapter': chapter,
        'mode': mode,
      },
    );
    final data = response.data;
    if (data is Map) {
      return data['answer'] ?? data['response'] ?? data['text'] ?? '';
    }
    return data.toString();
  }

  Future<String> imageChat({
    required String imagePath,
    required String classLevel,
    required String subject,
    required String chapter,
    required String mode,
    required String query,
  }) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(imagePath),
      'class_level': classLevel,
      'subject': subject,
      'chapter': chapter,
      'mode': mode,
      'user_query': query,
    });
    final response = await _client.postFormData('/api/chat/image', formData);
    final data = response.data;
    if (data is Map) {
      return data['answer'] ?? data['response'] ?? '';
    }
    return data.toString();
  }

  Future<Map<String, dynamic>> getDashboardData(String studentId) async {
    final response = await _client.get('/api/user/dashboard/$studentId');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getStreakData(String studentId) async {
    final response = await _client.get('/api/user/dashboard/$studentId');
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getTopQuestions({
    required String subject,
    required String classLevel,
    String mode = 'Simple',
    int limit = 10,
  }) async {
    final response = await _client.get(
      '/api/top-questions/top',
      queryParameters: {
        'subject': subject,
        'class_level': classLevel,
        'mode': mode,
        'limit': limit,
      },
    );
    final data = response.data;
    if (data is List) return List<Map<String, dynamic>>.from(data);
    if (data is Map && data['questions'] is List) {
      return List<Map<String, dynamic>>.from(data['questions']);
    }
    return [];
  }
}
