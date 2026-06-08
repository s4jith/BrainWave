/// A subject available to the student for book reading + AI chat,
/// from `GET /api/books/student/subjects` (`{ subjects: [...] }`).
class SubjectInfo {
  final String name;
  final bool hasAiSupport;

  const SubjectInfo({required this.name, required this.hasAiSupport});

  factory SubjectInfo.fromJson(Map<String, dynamic> json) {
    return SubjectInfo(
      name: json['name'] ?? json['subject'] ?? '',
      hasAiSupport: json['has_ai_support'] ?? json['hasAiSupport'] ?? false,
    );
  }
}

/// A book chapter/lesson from `GET /api/books/student/lessons`
/// (`{ lessons: [...] }`). `pdfUrl` may be relative and is absolutised by the
/// repository before use.
class LessonModel {
  final String id;
  final int number;
  final String title;
  final String description;
  final String pdfUrl;
  final String subject;
  final int classLevel;
  final bool hasAiSupport;
  final String bookId;
  final String processingStatus;

  const LessonModel({
    required this.id,
    required this.number,
    required this.title,
    required this.description,
    required this.pdfUrl,
    required this.subject,
    required this.classLevel,
    required this.hasAiSupport,
    required this.bookId,
    required this.processingStatus,
  });

  factory LessonModel.fromJson(Map<String, dynamic> json) {
    return LessonModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      number: json['number'] ?? json['chapter_number'] ?? 0,
      title: json['title'] ?? 'Untitled chapter',
      description: json['description'] ?? '',
      pdfUrl: (json['pdfUrl'] ?? json['pdf_url'] ?? '').toString(),
      subject: json['subject'] ?? '',
      classLevel: json['classLevel'] ?? json['class_level'] ?? 0,
      hasAiSupport: json['has_ai_support'] ?? json['hasAiSupport'] ?? false,
      bookId: (json['book_id'] ?? json['bookId'] ?? '').toString(),
      processingStatus:
          json['processing_status'] ?? json['processingStatus'] ?? 'uploaded',
    );
  }

  LessonModel copyWith({String? pdfUrl}) => LessonModel(
        id: id,
        number: number,
        title: title,
        description: description,
        pdfUrl: pdfUrl ?? this.pdfUrl,
        subject: subject,
        classLevel: classLevel,
        hasAiSupport: hasAiSupport,
        bookId: bookId,
        processingStatus: processingStatus,
      );
}
