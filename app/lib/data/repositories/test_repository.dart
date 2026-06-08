import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/test_model.dart';

final testRepositoryProvider =
    Provider<TestRepository>((ref) => TestRepository(ref.read(apiClientProvider)));

/// Test Center endpoints — AI-generated tests and Question-Bank tests
/// (`/api/test/*`). Both flows submit answers to the same `/complete` endpoint.
class TestRepository {
  final ApiClient _client;
  TestRepository(this._client);

  // ── AI tests ────────────────────────────────────────────────────────────
  Future<TestSession> startAITest({
    required String subject,
    required String chapter,
    required String classLevel,
    int numQuestions = 10,
  }) async {
    final res = await _client.post('/api/test/ai-test/start', data: {
      'subject': subject,
      'chapter': chapter,
      'class_level': classLevel,
      'num_questions': numQuestions,
    });
    return TestSession.fromJson(Json.map(res.data));
  }

  // ── Question-Bank tests ──────────────────────────────────────────────────
  Future<TestSession> startQBTest({
    required String subject,
    required String chapter,
    required String classLevel,
    int numQuestions = 10,
  }) async {
    final res = await _client.post('/api/test/qb-test/start', data: {
      'subject': subject,
      'chapter': chapter,
      'class_level': classLevel,
      'num_questions': numQuestions,
    });
    return TestSession.fromJson(Json.map(res.data));
  }

  Future<TestResult> completeTest({
    required String testId,
    required List<int> answers,
  }) async {
    final res = await _client
        .post('/api/test/complete', data: {'test_id': testId, 'answers': answers});
    return TestResult.fromJson(Json.map(res.data));
  }

  // ── Catalog (subjects / chapters) ────────────────────────────────────────
  Future<List<String>> getSubjects(String classLevel) async {
    final res = await _client.get('/api/test/subjects/$classLevel');
    return _stringList(res.data, 'subjects');
  }

  Future<List<String>> getChapters(String classLevel, String subject) async {
    final res = await _client
        .get('/api/test/chapters/$classLevel/${Uri.encodeComponent(subject)}');
    return _stringList(res.data, 'chapters');
  }

  Future<List<String>> getQBSubjects(String classLevel) async {
    final res = await _client.get('/api/test/qb-test/subjects/$classLevel');
    return _stringList(res.data, 'subjects');
  }

  Future<List<String>> getQBChapters(String classLevel, String subject) async {
    final res = await _client.get(
        '/api/test/qb-test/chapters/$classLevel/${Uri.encodeComponent(subject)}');
    return _stringList(res.data, 'chapters');
  }

  // ── History ──────────────────────────────────────────────────────────────
  Future<List<TestHistoryItem>> getHistory(String studentId) async {
    final res = await _client.get('/api/test/history/$studentId');
    return Json.list(res.data, ['history']).map(TestHistoryItem.fromJson).toList();
  }

  Future<void> deleteHistory(String sessionId) async {
    await _client.delete('/api/test/history/$sessionId');
  }

  List<String> _stringList(dynamic data, String key) {
    if (data is List) return data.map((e) => e.toString()).toList();
    if (data is Map && data[key] is List) {
      return (data[key] as List).map((e) => e.toString()).toList();
    }
    return const [];
  }
}
