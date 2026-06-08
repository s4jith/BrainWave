import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/career_model.dart';
import 'api_client.dart';

final careerServiceProvider = Provider((ref) => CareerService(ref.read(apiClientProvider)));

class CareerService {
  final ApiClient _client;
  CareerService(this._client);

  Future<List<CareerQuestion>> getQuestions() async {
    final response = await _client.get('/api/career/questions');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['questions'] is List) list = data['questions'];
    return list.map((j) => CareerQuestion.fromJson(j)).toList();
  }

  Future<String> startCareerTest() async {
    final response = await _client.post('/api/career/test/start', data: {});
    final data = response.data as Map<String, dynamic>;
    return data['test_id'] ?? data['_id'] ?? data['id'] ?? '';
  }

  // answers: list of {question_id, selected_option (int 0-3)}
  Future<CareerResult> submitCareerTest(
    String testId,
    List<Map<String, dynamic>> answers,
  ) async {
    final response = await _client.post(
      '/api/career/test/submit',
      data: {'test_id': testId, 'answers': answers},
    );
    return CareerResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<CareerResult> getResult(String resultId) async {
    final response = await _client.get('/api/career/results/$resultId');
    return CareerResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<CareerResult>> getMyResults() async {
    final response = await _client.get('/api/career/results/me');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['results'] is List) list = data['results'];
    return list.map((j) => CareerResult.fromJson(j)).toList();
  }
}

class SupportService {
  final ApiClient _client;
  SupportService(this._client);

  Future<List<SupportTicket>> getTickets() async {
    final response = await _client.get('/api/support-tickets/');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['tickets'] is List) list = data['tickets'];
    return list.map((j) => SupportTicket.fromJson(j)).toList();
  }

  Future<SupportTicket> createTicket({
    required String title,
    required String description,
    String priority = 'medium',
  }) async {
    final response = await _client.post('/api/support-tickets/', data: {
      'title': title,
      'description': description,
      'priority': priority,
    });
    return SupportTicket.fromJson(response.data as Map<String, dynamic>);
  }
}

final supportServiceProvider = Provider((ref) => SupportService(ref.read(apiClientProvider)));
