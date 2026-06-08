import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/course_model.dart';

final coursesRepositoryProvider = Provider<CoursesRepository>(
    (ref) => CoursesRepository(ref.read(apiClientProvider)));

/// Course endpoints (`/api/courses`). Students view their enrolled courses and
/// course detail (modules + content, including links to assessments).
class CoursesRepository {
  final ApiClient _client;
  CoursesRepository(this._client);

  Future<List<CourseSummary>> getMyCourses() async {
    final res = await _client.get('/api/courses/my-courses');
    return Json.list(res.data, ['courses']).map(CourseSummary.fromJson).toList();
  }

  Future<CourseDetail> getCourse(String courseId) async {
    final res = await _client.get('/api/courses/$courseId');
    return CourseDetail.fromJson(Json.map(res.data));
  }
}
