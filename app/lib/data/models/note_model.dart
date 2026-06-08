/// A student note from `/api/notes`. Tolerant of both `title/content` and the
/// backend's `heading/note_content` field names.
class NoteModel {
  final String id;
  final String studentId;
  final String title;
  final String content;
  final String subject;
  final String chapter;
  final String classLevel;
  final String noteType; // 'manual' | 'ai' | 'pdf'
  final DateTime createdAt;
  final DateTime updatedAt;

  const NoteModel({
    required this.id,
    required this.studentId,
    required this.title,
    required this.content,
    required this.subject,
    required this.chapter,
    required this.classLevel,
    required this.noteType,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NoteModel.fromJson(Map<String, dynamic> json) {
    DateTime parse(dynamic v) =>
        DateTime.tryParse('${v ?? ''}')?.toLocal() ?? DateTime.now();
    return NoteModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      studentId: (json['student_id'] ?? json['studentId'] ?? '').toString(),
      title: json['title'] ?? json['heading'] ?? 'Untitled Note',
      content: json['content'] ?? json['note_content'] ?? '',
      subject: json['subject'] ?? '',
      chapter: (json['chapter'] ?? '').toString(),
      classLevel: (json['class_level'] ?? json['classLevel'] ?? '').toString(),
      noteType: json['note_type'] ?? json['noteType'] ?? 'manual',
      createdAt: parse(json['created_at'] ?? json['createdAt']),
      updatedAt: parse(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'content': content,
        'subject': subject,
        'chapter': chapter,
        'class_level': classLevel,
        'note_type': noteType,
      };

  NoteModel copyWith({
    String? title,
    String? content,
    String? subject,
    String? chapter,
  }) {
    return NoteModel(
      id: id,
      studentId: studentId,
      title: title ?? this.title,
      content: content ?? this.content,
      subject: subject ?? this.subject,
      chapter: chapter ?? this.chapter,
      classLevel: classLevel,
      noteType: noteType,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }
}
