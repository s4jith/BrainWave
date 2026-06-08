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
      id: json['_id'] ?? json['id'] ?? '',
      question: json['question'] ?? '',
      options: List<String>.from(json['options'] ?? []),
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
    return CareerResult(
      id: json['_id'] ?? json['id'] ?? '',
      studentId: json['student_id'] ?? json['studentId'] ?? '',
      topCareers: List<String>.from(json['top_careers'] ?? json['topCareers'] ?? []),
      analysis: json['analysis'] ?? '',
      scores: Map<String, double>.from(
        (json['scores'] ?? {}).map((k, v) => MapEntry(k, (v as num).toDouble())),
      ),
      strengths: List<String>.from(json['strengths'] ?? []),
      recommendations: List<String>.from(json['recommendations'] ?? []),
      createdAt: DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class SupportTicket {
  final String id;
  final String title;
  final String description;
  final String status; // 'open' | 'in_progress' | 'resolved' | 'closed'
  final String priority; // 'low' | 'medium' | 'high'
  final DateTime createdAt;
  final DateTime? resolvedAt;

  const SupportTicket({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.resolvedAt,
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'open',
      priority: json['priority'] ?? 'medium',
      createdAt: DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ?? DateTime.now(),
      resolvedAt: json['resolved_at'] != null
          ? DateTime.tryParse(json['resolved_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'priority': priority,
  };
}
