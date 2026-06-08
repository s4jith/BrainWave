import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/career_model.dart';

final careerRepositoryProvider = Provider<CareerRepository>(
    (ref) => CareerRepository(ref.read(apiClientProvider)));

/// Career aptitude test endpoints (`/api/career/*`).
class CareerRepository {
  final ApiClient _client;
  CareerRepository(this._client);

  Future<List<CareerQuestion>> getQuestions() async {
    final res = await _client.get('/api/career/questions');
    return Json.list(res.data, ['questions']).map(CareerQuestion.fromJson).toList();
  }

  Future<String> startTest() async {
    final res = await _client.post('/api/career/test/start', data: {});
    final data = Json.map(res.data);
    return (data['test_id'] ?? data['_id'] ?? data['id'] ?? '').toString();
  }

  /// [answers] is a list of `{question_id, selected_option}` maps.
  Future<CareerResult> submitTest(
    String testId,
    List<Map<String, dynamic>> answers,
  ) async {
    final res = await _client.post('/api/career/test/submit',
        data: {'test_id': testId, 'answers': answers});
    return CareerResult.fromJson(Json.map(res.data));
  }

  Future<CareerResult> getResult(String resultId) async {
    final res = await _client.get('/api/career/results/$resultId');
    return CareerResult.fromJson(Json.map(res.data));
  }

  Future<List<CareerResult>> getMyResults() async {
    final res = await _client.get('/api/career/results/me');
    return Json.list(res.data, ['results']).map(CareerResult.fromJson).toList();
  }
}
