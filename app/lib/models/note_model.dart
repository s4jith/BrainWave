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
    return NoteModel(
      id: json['_id'] ?? json['id'] ?? '',
      studentId: json['student_id'] ?? json['studentId'] ?? '',
      title: json['title'] ?? 'Untitled Note',
      content: json['content'] ?? '',
      subject: json['subject'] ?? '',
      chapter: json['chapter'] ?? '',
      classLevel: json['class_level'] ?? json['classLevel'] ?? '',
      noteType: json['note_type'] ?? json['noteType'] ?? 'manual',
      createdAt: DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] ?? json['updatedAt'] ?? '') ?? DateTime.now(),
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
