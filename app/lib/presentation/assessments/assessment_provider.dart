import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/assessment_model.dart';
import '../../data/repositories/assessment_repository.dart';

/// Assessments visible to the student.
final assessmentsListProvider =
    FutureProvider.autoDispose<List<AssessmentSummary>>((ref) {
  return ref.read(assessmentRepositoryProvider).listAssessments();
});

/// The student's past assessment submissions.
final mySubmissionsProvider =
    FutureProvider.autoDispose<List<AssessmentSubmission>>((ref) {
  return ref.read(assessmentRepositoryProvider).getMySubmissions();
});

/// Loads an attempt (student view — correct answers hidden).
final studentAssessmentProvider =
    FutureProvider.autoDispose.family<StudentAssessment, String>((ref, id) {
  return ref.read(assessmentRepositoryProvider).start(id);
});

/// A graded submission with answers + feedback.
final submissionDetailProvider =
    FutureProvider.autoDispose.family<SubmissionDetail, String>((ref, id) {
  return ref.read(assessmentRepositoryProvider).getSubmissionDetail(id);
});
