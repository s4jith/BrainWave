/// A student suggestion/feedback item (`/api/suggestions`).
/// `GET /api/suggestions/student/{student_id}` returns `{ suggestions: [...] }`.
class SuggestionModel {
  final String id;
  final String category; // general | feature | ui | content | bug | other
  final String subject;
  final String content;
  final String status; // pending | reviewed | ...
  final String? adminResponse;
  final DateTime createdAt;
  final DateTime? reviewedAt;

  const SuggestionModel({
    required this.id,
    required this.category,
    required this.subject,
    required this.content,
    required this.status,
    this.adminResponse,
    required this.createdAt,
    this.reviewedAt,
  });

  factory SuggestionModel.fromJson(Map<String, dynamic> json) {
    return SuggestionModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      category: json['category'] ?? 'general',
      subject: json['subject'] ?? '',
      content: json['content'] ?? '',
      status: json['status'] ?? 'pending',
      adminResponse: json['admin_response'] ?? json['adminResponse'],
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt'] ?? ''}')
                  ?.toLocal() ??
              DateTime.now(),
      reviewedAt:
          DateTime.tryParse('${json['reviewed_at'] ?? json['reviewedAt'] ?? ''}')
              ?.toLocal(),
    );
  }

  bool get isReviewed =>
      status.toLowerCase() != 'pending' || (adminResponse?.isNotEmpty ?? false);

  /// Categories the student can choose when filing a suggestion.
  static const categories = ['general', 'feature', 'ui', 'content', 'bug', 'other'];
}
