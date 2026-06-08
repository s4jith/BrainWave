import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/dashboard_model.dart';
import '../models/group_model.dart';
import '../models/query_model.dart';
import '../models/user_model.dart';

final studentRepositoryProvider = Provider<StudentRepository>(
    (ref) => StudentRepository(ref.read(apiClientProvider)));

/// Student profile, dashboard, progress, groups and queries.
class StudentRepository {
  final ApiClient _client;
  StudentRepository(this._client);

  Future<UserModel> getProfile() async {
    final res = await _client.get('/api/student/profile');
    return UserModel.fromJson(Json.map(res.data));
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    await _client.put('/api/student/profile', data: data);
  }

  /// Feature flags controlling which areas are enabled for this student.
  /// Normalises `{features: {...}}` and bare `{...}` to a `{key: bool}` map.
  Future<Map<String, bool>> getFeatures() async {
    final res = await _client.get('/api/student/my-features');
    final data = Json.map(res.data);
    final raw = (data['features'] is Map)
        ? (data['features'] as Map)
        : data;
    return raw.map((k, v) => MapEntry(k.toString(), v == true));
  }

  Future<DashboardModel> getDashboard(String studentId) async {
    final res = await _client.get('/api/user/dashboard/$studentId');
    return DashboardModel.fromJson(Json.map(res.data));
  }

  Future<ProgressData> getProgress(String studentId) async {
    final res = await _client.get('/api/user/progress/$studentId');
    final data = Json.map(res.data);
    // `/progress` returns ProgressData; some deployments nest it under `progress`.
    return ProgressData.fromJson(
        data['progress'] is Map ? Json.map(data['progress']) : data);
  }

  Future<void> logActivity(String studentId, {double hours = 0.1}) async {
    await _client.post('/api/user/activity/log',
        queryParameters: {'student_id': studentId, 'hours': hours});
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  Future<List<GroupModel>> getGroups() async {
    final res = await _client.get('/api/student/groups');
    return Json.list(res.data, ['groups']).map(GroupModel.fromJson).toList();
  }

  // ── Queries (student ↔ teacher) ─────────────────────────────────────────────
  Future<List<QueryModel>> getQueries() async {
    final res = await _client.get('/api/queries/student');
    return Json.list(res.data, ['queries']).map(QueryModel.fromJson).toList();
  }

  Future<QueryModel> createQuery({
    required String question,
    required String subject,
  }) async {
    final res = await _client.post('/api/queries',
        data: {'question': question, 'subject': subject});
    return QueryModel.fromJson(Json.map(res.data));
  }
}
