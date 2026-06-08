import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/query_model.dart';
import '../models/user_model.dart';
import 'api_client.dart';

final studentServiceProvider = Provider((ref) => StudentService(ref.read(apiClientProvider)));

class StudentService {
  final ApiClient _client;
  StudentService(this._client);

  Future<UserModel> getProfile() async {
    final response = await _client.get('/api/student/profile');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> getFeatures() async {
    final response = await _client.get('/api/student/my-features');
    return response.data as Map<String, dynamic>;
  }

  Future<List<GroupModel>> getGroups() async {
    final response = await _client.get('/api/student/groups');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['groups'] is List) list = data['groups'];
    return list.map((j) => GroupModel.fromJson(j)).toList();
  }

  Future<Map<String, dynamic>> getDashboardData(String studentId) async {
    final response = await _client.get('/api/user/dashboard/$studentId');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getProgressData(String studentId) async {
    final response = await _client.get('/api/user/progress/$studentId');
    return response.data as Map<String, dynamic>;
  }

  Future<void> logActivity(String studentId, double hours) async {
    await _client.post('/api/user/activity/log', data: {
      'student_id': studentId,
      'hours': hours,
    });
  }

  // Queries
  Future<List<QueryModel>> getQueries() async {
    final response = await _client.get('/api/queries/student');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['queries'] is List) list = data['queries'];
    return list.map((j) => QueryModel.fromJson(j)).toList();
  }

  Future<QueryModel> createQuery({
    required String question,
    required String subject,
  }) async {
    final response = await _client.post('/api/queries', data: {
      'question': question,
      'subject': subject,
    });
    return QueryModel.fromJson(response.data as Map<String, dynamic>);
  }

  // Gradebook
  Future<List<GradeModel>> getGrades() async {
    final response = await _client.get('/api/gradebook/my-grades');
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['grades'] is List) list = data['grades'];
    return list.map((j) => GradeModel.fromJson(j)).toList();
  }

  // Report card — uses progress endpoint
  Future<Map<String, dynamic>> getReportCard(String studentId) async {
    final response = await _client.get('/api/user/progress/$studentId');
    return response.data as Map<String, dynamic>;
  }

  // Profile update
  Future<void> updateProfile(Map<String, dynamic> data) async {
    await _client.put('/api/student/profile', data: data);
  }
}
