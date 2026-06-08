/// A student → teacher subject question from `/api/queries`.
class QueryModel {
  final String id;
  final String studentId;
  final String question;
  final String subject;
  final String status; // 'pending' | 'answered' | 'closed'
  final String? answer;
  final String? answeredBy;
  final DateTime createdAt;
  final DateTime? answeredAt;

  const QueryModel({
    required this.id,
    required this.studentId,
    required this.question,
    required this.subject,
    required this.status,
    this.answer,
    this.answeredBy,
    required this.createdAt,
    this.answeredAt,
  });

  factory QueryModel.fromJson(Map<String, dynamic> json) {
    return QueryModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      studentId: (json['student_id'] ?? json['studentId'] ?? '').toString(),
      question: json['question'] ?? '',
      subject: json['subject'] ?? '',
      status: json['status'] ?? 'pending',
      answer: json['answer'],
      answeredBy: json['answered_by'] ?? json['answeredBy'],
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt'] ?? ''}')
                  ?.toLocal() ??
              DateTime.now(),
      answeredAt: json['answered_at'] != null
          ? DateTime.tryParse('${json['answered_at']}')?.toLocal()
          : null,
    );
  }

  bool get isAnswered => status == 'answered' || (answer?.isNotEmpty ?? false);
}
