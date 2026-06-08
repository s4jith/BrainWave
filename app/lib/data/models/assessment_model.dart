/// Assessment models (`/api/assessments`).
///
/// - [AssessmentSummary]  → list item (`AssessmentResponse`).
/// - [StudentAssessment]  → `GET /{id}/start` (`StudentAssessmentView`, answers hidden).
/// - [AssessmentSubmission] / [SubmissionDetail] → submissions.
/// - [AnswerSubmission]   → request payload builder for `POST /{id}/submit`.
library;

class AssessmentSummary {
  final String id;
  final String? courseId;
  final String title;
  final String description;
  final String type; // quiz | exam | assignment | practice
  final String subject;
  final int classLevel;
  final String status; // draft | published | closed
  final int questionCount;
  final int totalPoints;
  final int? timeLimitMinutes;
  final DateTime? dueDate;
  final bool hasAttempted;
  final double? bestScore;
  final int? attemptsRemaining;
  final String evaluationType; // ai | manual

  const AssessmentSummary({
    required this.id,
    this.courseId,
    required this.title,
    required this.description,
    required this.type,
    required this.subject,
    required this.classLevel,
    required this.status,
    required this.questionCount,
    required this.totalPoints,
    this.timeLimitMinutes,
    this.dueDate,
    required this.hasAttempted,
    this.bestScore,
    this.attemptsRemaining,
    required this.evaluationType,
  });

  factory AssessmentSummary.fromJson(Map<String, dynamic> json) {
    final settings = (json['settings'] is Map)
        ? (json['settings'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    return AssessmentSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      courseId: (json['course_id'] ?? json['courseId'])?.toString(),
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'quiz',
      subject: json['subject'] ?? '',
      classLevel: json['class_level'] ?? json['classLevel'] ?? 0,
      status: json['status'] ?? 'published',
      questionCount: json['question_count'] ?? json['questionCount'] ?? 0,
      totalPoints: json['total_points'] ?? json['totalPoints'] ?? 0,
      timeLimitMinutes: json['time_limit_minutes'] ??
          settings['time_limit_minutes'] ??
          json['duration_minutes'],
      dueDate: DateTime.tryParse('${json['due_date'] ?? ''}')?.toLocal(),
      hasAttempted: json['has_attempted'] ?? json['hasAttempted'] ?? false,
      bestScore: (json['best_score'] as num?)?.toDouble(),
      attemptsRemaining: json['attempts_remaining'] ?? json['attemptsRemaining'],
      evaluationType: json['evaluation_type'] ?? json['evaluationType'] ?? 'manual',
    );
  }
}

class AssessmentOption {
  final String id;
  final String text;
  final bool isCorrect; // hidden (false) in the student view

  const AssessmentOption(
      {required this.id, required this.text, this.isCorrect = false});

  factory AssessmentOption.fromJson(Map<String, dynamic> json) {
    return AssessmentOption(
      id: (json['id'] ?? '').toString(),
      text: json['text'] ?? '',
      isCorrect: json['is_correct'] ?? json['isCorrect'] ?? false,
    );
  }
}

class AssessmentQuestion {
  final String id;
  final String type; // mcq | mcq_multi | true_false | short_answer | essay | ...
  final String questionText;
  final String? explanation;
  final int points;
  final int order;
  final List<AssessmentOption> options;

  const AssessmentQuestion({
    required this.id,
    required this.type,
    required this.questionText,
    this.explanation,
    required this.points,
    required this.order,
    required this.options,
  });

  factory AssessmentQuestion.fromJson(Map<String, dynamic> json) {
    return AssessmentQuestion(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      type: json['type'] ?? 'mcq',
      questionText: json['question_text'] ?? json['questionText'] ?? '',
      explanation: json['explanation'],
      points: json['points'] ?? 1,
      order: json['order'] ?? 0,
      options: (json['options'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => AssessmentOption.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }

  bool get isMulti => type == 'mcq_multi';
  bool get isBoolean => type == 'true_false';
  bool get isText => type == 'short_answer' || type == 'essay' || type == 'fill_blank';
  bool get isChoice => type == 'mcq' || type == 'mcq_multi';
}

class StudentAssessment {
  final String id;
  final String title;
  final String description;
  final String type;
  final int? timeLimitMinutes;
  final int questionCount;
  final int totalPoints;
  final List<AssessmentQuestion> questions;

  const StudentAssessment({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    this.timeLimitMinutes,
    required this.questionCount,
    required this.totalPoints,
    required this.questions,
  });

  factory StudentAssessment.fromJson(Map<String, dynamic> json) {
    return StudentAssessment(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'quiz',
      timeLimitMinutes: json['time_limit_minutes'] ?? json['timeLimitMinutes'],
      questionCount: json['question_count'] ?? json['questionCount'] ?? 0,
      totalPoints: json['total_points'] ?? json['totalPoints'] ?? 0,
      questions: (json['questions'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => AssessmentQuestion.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }
}

class AssessmentSubmission {
  final String id;
  final String assessmentId;
  final String studentName;
  final int attemptNumber;
  final String status; // in_progress | submitted | graded | returned
  final int totalScore;
  final int maxScore;
  final double percentage;
  final bool passed;
  final DateTime? submittedAt;
  final DateTime? gradedAt;
  final String? adminComment;
  final bool isReviewed;

  const AssessmentSubmission({
    required this.id,
    required this.assessmentId,
    required this.studentName,
    required this.attemptNumber,
    required this.status,
    required this.totalScore,
    required this.maxScore,
    required this.percentage,
    required this.passed,
    this.submittedAt,
    this.gradedAt,
    this.adminComment,
    required this.isReviewed,
  });

  factory AssessmentSubmission.fromJson(Map<String, dynamic> json) {
    return AssessmentSubmission(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      assessmentId: (json['assessment_id'] ?? json['assessmentId'] ?? '').toString(),
      studentName: json['student_name'] ?? json['studentName'] ?? '',
      attemptNumber: json['attempt_number'] ?? json['attemptNumber'] ?? 1,
      status: json['status'] ?? 'submitted',
      totalScore: json['total_score'] ?? json['totalScore'] ?? 0,
      maxScore: json['max_score'] ?? json['maxScore'] ?? 0,
      percentage: (json['percentage'] ?? 0).toDouble(),
      passed: json['passed'] ?? false,
      submittedAt: DateTime.tryParse('${json['submitted_at'] ?? ''}')?.toLocal(),
      gradedAt: DateTime.tryParse('${json['graded_at'] ?? ''}')?.toLocal(),
      adminComment: json['admin_comment'] ?? json['adminComment'],
      isReviewed: json['is_reviewed'] ?? json['isReviewed'] ?? false,
    );
  }

  bool get isGraded => status == 'graded' || status == 'returned';
}

class SubmissionDetail extends AssessmentSubmission {
  final Map<String, dynamic> feedback;
  final String? overallFeedback;
  final int timeSpentSeconds;

  const SubmissionDetail({
    required super.id,
    required super.assessmentId,
    required super.studentName,
    required super.attemptNumber,
    required super.status,
    required super.totalScore,
    required super.maxScore,
    required super.percentage,
    required super.passed,
    super.submittedAt,
    super.gradedAt,
    super.adminComment,
    required super.isReviewed,
    required this.feedback,
    this.overallFeedback,
    required this.timeSpentSeconds,
  });

  factory SubmissionDetail.fromJson(Map<String, dynamic> json) {
    final base = AssessmentSubmission.fromJson(json);
    return SubmissionDetail(
      id: base.id,
      assessmentId: base.assessmentId,
      studentName: base.studentName,
      attemptNumber: base.attemptNumber,
      status: base.status,
      totalScore: base.totalScore,
      maxScore: base.maxScore,
      percentage: base.percentage,
      passed: base.passed,
      submittedAt: base.submittedAt,
      gradedAt: base.gradedAt,
      adminComment: base.adminComment,
      isReviewed: base.isReviewed,
      feedback: (json['feedback'] is Map)
          ? (json['feedback'] as Map).cast<String, dynamic>()
          : const {},
      overallFeedback: json['overall_feedback'] ?? json['overallFeedback'],
      timeSpentSeconds: json['time_spent_seconds'] ?? json['timeSpentSeconds'] ?? 0,
    );
  }
}

/// One answer in a submission. Built by the taker UI and serialised for
/// `POST /api/assessments/{id}/submit` (`SubmitAssessmentRequest`).
class AnswerSubmission {
  final String questionId;
  final List<String> selectedOptionIds;
  final bool? answerBool;
  final String? answerText;

  const AnswerSubmission({
    required this.questionId,
    this.selectedOptionIds = const [],
    this.answerBool,
    this.answerText,
  });

  Map<String, dynamic> toJson() => {
        'question_id': questionId,
        'selected_option_ids': selectedOptionIds,
        if (answerBool != null) 'answer_bool': answerBool,
        if (answerText != null) 'answer_text': answerText,
      };

  bool get isAnswered =>
      selectedOptionIds.isNotEmpty ||
      answerBool != null ||
      (answerText != null && answerText!.trim().isNotEmpty);
}
