import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/grade_model.dart';

final gradebookRepositoryProvider = Provider<GradebookRepository>(
    (ref) => GradebookRepository(ref.read(apiClientProvider)));

/// Normalised result of `/api/gradebook/my-grades`. The analytics service shape
/// varies, so this captures the headline number plus a per-course breakdown.
class GradebookResult {
  final double overallPercentage;
  final String overallLetter;
  final List<GradeModel> grades;

  const GradebookResult({
    required this.overallPercentage,
    required this.overallLetter,
    required this.grades,
  });
}

class GradebookRepository {
  final ApiClient _client;
  GradebookRepository(this._client);

  Future<GradebookResult> getMyGrades({String? courseId}) async {
    final res = await _client.get('/api/gradebook/my-grades',
        queryParameters: courseId == null ? null : {'course_id': courseId});
    final data = Json.map(res.data);

    // Find the per-course/subject grade list under any of the common keys.
    final list = Json.list(data, ['grades', 'courses', 'subjects', 'items']);
    final grades = list.map(GradeModel.fromJson).toList();

    double overall = _num(data, ['overall', 'overall_percentage', 'average', 'gpa_percentage']);
    if (overall == 0 && grades.isNotEmpty) {
      overall = grades.map((g) => g.percentage).reduce((a, b) => a + b) /
          grades.length;
    }

    return GradebookResult(
      overallPercentage: overall,
      overallLetter: GradeModel.fromJson({'percentage': overall}).letterGrade,
      grades: grades,
    );
  }

  double _num(Map<String, dynamic> data, List<String> keys) {
    for (final k in keys) {
      final v = data[k];
      if (v is num) return v.toDouble();
      final p = double.tryParse('${v ?? ''}');
      if (p != null) return p;
    }
    return 0;
  }
}
