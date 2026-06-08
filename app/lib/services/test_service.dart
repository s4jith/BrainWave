import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/test_model.dart';
import 'api_client.dart';

final testServiceProvider = Provider((ref) => TestService(ref.read(apiClientProvider)));

class TestService {
  final ApiClient _client;
  TestService(this._client);

  // AI Tests
  Future<TestSession> startAITest({
    required String subject,
    required String chapter,
    required String classLevel,
    int numQuestions = 10,
  }) async {
    final response = await _client.post(
      '/api/test/ai-test/start',
      data: {
        'subject': subject,
        'chapter': chapter,
        'class_level': classLevel,
        'num_questions': numQuestions,
      },
    );
    return TestSession.fromJson(response.data as Map<String, dynamic>);
  }

  // Both AI and QB tests use the same /complete endpoint
  Future<TestResult> completeAITest({
    required String testId,
    required List<int> answers,
  }) async {
    final response = await _client.post(
      '/api/test/complete',
      data: {'test_id': testId, 'answers': answers},
    );
    return TestResult.fromJson(response.data as Map<String, dynamic>);
  }

  // QB Tests
  Future<List<String>> getQBSubjects(String classLevel) async {
    final response = await _client.get('/api/test/qb-test/subjects/$classLevel');
    final data = response.data;
    if (data is List) return List<String>.from(data);
    if (data is Map && data['subjects'] is List) {
      return List<String>.from(data['subjects']);
    }
    return [];
  }

  Future<List<String>> getQBChapters(String classLevel, String subject) async {
    final encoded = Uri.encodeComponent(subject);
    final response = await _client.get('/api/test/qb-test/chapters/$classLevel/$encoded');
    final data = response.data;
    if (data is List) return List<String>.from(data);
    if (data is Map && data['chapters'] is List) {
      return List<String>.from(data['chapters']);
    }
    return [];
  }

  Future<TestSession> startQBTest({
    required String subject,
    required String chapter,
    required String classLevel,
    int numQuestions = 10,
  }) async {
    final response = await _client.post(
      '/api/test/qb-test/start',
      data: {
        'subject': subject,
        'chapter': chapter,
        'class_level': classLevel,
        'num_questions': numQuestions,
      },
    );
    return TestSession.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TestResult> completeQBTest({
    required String testId,
    required List<int> answers,
  }) async {
    final response = await _client.post(
      '/api/test/complete',
      data: {'test_id': testId, 'answers': answers},
    );
    return TestResult.fromJson(response.data as Map<String, dynamic>);
  }

  // Staff tests
  Future<List<Map<String, dynamic>>> getStaffTests() async {
    final response = await _client.get('/api/test/staff-tests');
    final data = response.data;
    if (data is List) return List<Map<String, dynamic>>.from(data);
    if (data is Map && data['tests'] is List) {
      return List<Map<String, dynamic>>.from(data['tests']);
    }
    return [];
  }

  // History — requires student_id path param
  Future<List<TestHistoryItem>> getTestHistory(String studentId) async {
    final response = await _client.get('/api/test/history/$studentId');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['history'] is List) list = data['history'];
    return list.map((j) => TestHistoryItem.fromJson(j)).toList();
  }

  Future<TestResult> getTestResult(String sessionId) async {
    final response = await _client.get('/api/test/result/$sessionId');
    return TestResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteTestHistory(String sessionId) async {
    await _client.delete('/api/test/history/$sessionId');
  }

  // Analytics — requires student_id path param
  Future<Map<String, dynamic>> getStudentAnalytics(String studentId) async {
    final response = await _client.get('/api/test/analytics/$studentId');
    return response.data as Map<String, dynamic>;
  }

  Future<List<String>> getAvailableSubjects(String classLevel) async {
    final response = await _client.get('/api/test/subjects/$classLevel');
    final data = response.data;
    if (data is List) return List<String>.from(data);
    if (data is Map && data['subjects'] is List) {
      return List<String>.from(data['subjects']);
    }
    return [];
  }

  Future<List<String>> getChaptersForSubject(String classLevel, String subject) async {
    final encoded = Uri.encodeComponent(subject);
    final response = await _client.get('/api/test/chapters/$classLevel/$encoded');
    final data = response.data;
    if (data is List) return List<String>.from(data);
    if (data is Map && data['chapters'] is List) {
      return List<String>.from(data['chapters']);
    }
    return [];
  }
}
