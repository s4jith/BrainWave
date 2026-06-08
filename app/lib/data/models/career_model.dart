/// Career aptitude test models (`/api/career/*`).
library;

class CareerQuestion {
  final String id;
  final String question;
  final List<String> options;
  final String category;

  const CareerQuestion({
    required this.id,
    required this.question,
    required this.options,
    required this.category,
  });

  factory CareerQuestion.fromJson(Map<String, dynamic> json) {
    return CareerQuestion(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      question: json['question'] ?? '',
      options: List<String>.from(json['options'] ?? const []),
      category: json['category'] ?? '',
    );
  }
}

class CareerResult {
  final String id;
  final String studentId;
  final List<String> topCareers;
  final String analysis;
  final Map<String, double> scores;
  final List<String> strengths;
  final List<String> recommendations;
  final DateTime createdAt;

  const CareerResult({
    required this.id,
    required this.studentId,
    required this.topCareers,
    required this.analysis,
    required this.scores,
    required this.strengths,
    required this.recommendations,
    required this.createdAt,
  });

  factory CareerResult.fromJson(Map<String, dynamic> json) {
    final rawScores = (json['scores'] ?? const {}) as Map;
    return CareerResult(
      id: (json['_id'] ?? json['id'] ?? json['result_id'] ?? '').toString(),
      studentId: (json['student_id'] ?? json['studentId'] ?? '').toString(),
      topCareers: List<String>.from(
          json['top_careers'] ?? json['topCareers'] ?? const []),
      analysis: json['analysis'] ?? '',
      scores: rawScores.map(
          (k, v) => MapEntry(k.toString(), (v is num ? v.toDouble() : 0.0))),
      strengths: List<String>.from(json['strengths'] ?? const []),
      recommendations:
          List<String>.from(json['recommendations'] ?? const []),
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt'] ?? ''}')
                  ?.toLocal() ??
              DateTime.now(),
    );
  }
}
