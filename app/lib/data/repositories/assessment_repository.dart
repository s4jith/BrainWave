import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/assessment_model.dart';

final assessmentRepositoryProvider = Provider<AssessmentRepository>(
    (ref) => AssessmentRepository(ref.read(apiClientProvider)));

/// Assessment endpoints (`/api/assessments`). Students list assessments, start
/// an attempt (answers hidden), submit answers, and review past submissions.
class AssessmentRepository {
  final ApiClient _client;
  AssessmentRepository(this._client);

  Future<List<AssessmentSummary>> listAssessments({String? courseId}) async {
    final res = await _client.get('/api/assessments',
        queryParameters: courseId == null ? null : {'course_id': courseId});
    return Json.list(res.data, ['assessments'])
        .map(AssessmentSummary.fromJson)
        .toList();
  }

  Future<List<AssessmentSubmission>> getMySubmissions() async {
    final res = await _client.get('/api/assessments/submissions/my');
    return Json.list(res.data, ['submissions'])
        .map(AssessmentSubmission.fromJson)
        .toList();
  }

  /// Begins/loads an attempt — returns the student view (no correct answers).
  Future<StudentAssessment> start(String assessmentId) async {
    final res = await _client.get('/api/assessments/$assessmentId/start');
    return StudentAssessment.fromJson(Json.map(res.data));
  }

  Future<SubmissionDetail> submit({
    required String assessmentId,
    required List<AnswerSubmission> answers,
  }) async {
    final res = await _client.post('/api/assessments/$assessmentId/submit',
        data: {'answers': answers.map((a) => a.toJson()).toList()});
    return SubmissionDetail.fromJson(Json.map(res.data));
  }

  Future<SubmissionDetail> getSubmissionDetail(String submissionId) async {
    final res =
        await _client.get('/api/assessments/submissions/$submissionId/detail');
    return SubmissionDetail.fromJson(Json.map(res.data));
  }
}
