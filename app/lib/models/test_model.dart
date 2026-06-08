class TestQuestion {
  final String id;
  final String question;
  final List<String> options;
  final int? correctIndex;
  final String? explanation;

  const TestQuestion({
    required this.id,
    required this.question,
    required this.options,
    this.correctIndex,
    this.explanation,
  });

  factory TestQuestion.fromJson(Map<String, dynamic> json) {
    final opts = json['options'];
    List<String> parsedOptions = [];
    if (opts is List) {
      parsedOptions = List<String>.from(opts);
    } else if (opts is Map) {
      parsedOptions = [
        opts['A'] ?? '',
        opts['B'] ?? '',
        opts['C'] ?? '',
        opts['D'] ?? '',
      ];
    }
    return TestQuestion(
      id: json['_id'] ?? json['id'] ?? '',
      question: json['question'] ?? '',
      options: parsedOptions,
      correctIndex: json['correct_index'] ?? json['correctIndex'],
      explanation: json['explanation'],
    );
  }
}

class TestSession {
  final String testId;
  final String subject;
  final String chapter;
  final String classLevel;
  final String testType;
  final List<TestQuestion> questions;

  const TestSession({
    required this.testId,
    required this.subject,
    required this.chapter,
    required this.classLevel,
    required this.testType,
    required this.questions,
  });

  factory TestSession.fromJson(Map<String, dynamic> json) {
    return TestSession(
      testId: json['test_id'] ?? json['testId'] ?? '',
      subject: json['subject'] ?? '',
      chapter: json['chapter'] ?? '',
      classLevel: json['class_level'] ?? json['classLevel'] ?? '',
      testType: json['test_type'] ?? json['testType'] ?? 'ai',
      questions: (json['questions'] as List<dynamic>? ?? [])
          .map((q) => TestQuestion.fromJson(q))
          .toList(),
    );
  }
}

class TestResult {
  final String testId;
  final int score;
  final int total;
  final double percentage;
  final String subject;
  final String chapter;
  final DateTime completedAt;
  final List<QuestionResult> questionResults;

  const TestResult({
    required this.testId,
    required this.score,
    required this.total,
    required this.percentage,
    required this.subject,
    required this.chapter,
    required this.completedAt,
    required this.questionResults,
  });

  factory TestResult.fromJson(Map<String, dynamic> json) {
    return TestResult(
      testId: json['test_id'] ?? json['testId'] ?? '',
      score: json['score'] ?? 0,
      total: json['total'] ?? 0,
      percentage: (json['percentage'] ?? 0).toDouble(),
      subject: json['subject'] ?? '',
      chapter: json['chapter'] ?? '',
      completedAt: DateTime.tryParse(json['completed_at'] ?? '') ?? DateTime.now(),
      questionResults: (json['question_results'] as List<dynamic>? ?? [])
          .map((r) => QuestionResult.fromJson(r))
          .toList(),
    );
  }

  String get grade {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  }
}

class QuestionResult {
  final String question;
  final int selectedIndex;
  final int correctIndex;
  final bool isCorrect;
  final String? explanation;

  const QuestionResult({
    required this.question,
    required this.selectedIndex,
    required this.correctIndex,
    required this.isCorrect,
    this.explanation,
  });

  factory QuestionResult.fromJson(Map<String, dynamic> json) {
    return QuestionResult(
      question: json['question'] ?? '',
      selectedIndex: json['selected_index'] ?? json['selectedIndex'] ?? -1,
      correctIndex: json['correct_index'] ?? json['correctIndex'] ?? 0,
      isCorrect: json['is_correct'] ?? json['isCorrect'] ?? false,
      explanation: json['explanation'],
    );
  }
}

class TestHistoryItem {
  final String id;
  final String subject;
  final String chapter;
  final String testType;
  final int score;
  final int total;
  final double percentage;
  final DateTime completedAt;

  const TestHistoryItem({
    required this.id,
    required this.subject,
    required this.chapter,
    required this.testType,
    required this.score,
    required this.total,
    required this.percentage,
    required this.completedAt,
  });

  factory TestHistoryItem.fromJson(Map<String, dynamic> json) {
    return TestHistoryItem(
      id: json['_id'] ?? json['id'] ?? '',
      subject: json['subject'] ?? '',
      chapter: json['chapter'] ?? '',
      testType: json['test_type'] ?? json['testType'] ?? '',
      score: json['score'] ?? 0,
      total: json['total'] ?? 0,
      percentage: (json['percentage'] ?? 0).toDouble(),
      completedAt: DateTime.tryParse(
        json['completed_at'] ?? json['completedAt'] ?? '',
      ) ?? DateTime.now(),
    );
  }
}
