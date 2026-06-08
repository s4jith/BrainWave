/// Support ticket models for `/api/support-tickets`.
library;

class SupportReply {
  final String message;
  final bool isAdmin;
  final String authorName;
  final DateTime? createdAt;

  const SupportReply({
    required this.message,
    required this.isAdmin,
    required this.authorName,
    this.createdAt,
  });

  factory SupportReply.fromJson(Map<String, dynamic> json) {
    return SupportReply(
      message: json['message'] ?? json['text'] ?? '',
      isAdmin: json['is_admin'] ?? json['isAdmin'] ?? false,
      authorName: json['author_name'] ?? json['authorName'] ?? 'User',
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt'] ?? ''}')
              ?.toLocal(),
    );
  }
}

class SupportTicket {
  final String id;
  final String ticketNumber;
  final String title;
  final String description;
  final String category;
  final String priority; // low | medium | high | urgent
  final String status; // open | in_progress | resolved | closed
  final String createdByName;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final List<SupportReply> replies;

  const SupportTicket({
    required this.id,
    required this.ticketNumber,
    required this.title,
    required this.description,
    required this.category,
    required this.priority,
    required this.status,
    required this.createdByName,
    required this.createdAt,
    this.updatedAt,
    this.replies = const [],
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      ticketNumber: json['ticket_number'] ?? json['ticketNumber'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? 'general',
      priority: json['priority'] ?? 'medium',
      status: json['status'] ?? 'open',
      createdByName:
          json['created_by_name'] ?? json['createdByName'] ?? 'You',
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['createdAt'] ?? ''}')
                  ?.toLocal() ??
              DateTime.now(),
      updatedAt:
          DateTime.tryParse('${json['updated_at'] ?? json['updatedAt'] ?? ''}')
              ?.toLocal(),
      replies: (json['replies'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => SupportReply.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }
}
