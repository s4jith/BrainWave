/// Course models (`/api/courses`). Students use these for gradebook context and
/// to launch course-linked assessments.
library;

class ContentItem {
  final String id;
  final String type; // video | pdf | document | quiz | assignment | text
  final String title;
  final String? description;
  final String? url;
  final String? content;
  final int durationMinutes;
  final int order;
  final bool isRequired;
  final String? assessmentId;

  const ContentItem({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    this.url,
    this.content,
    required this.durationMinutes,
    required this.order,
    required this.isRequired,
    this.assessmentId,
  });

  factory ContentItem.fromJson(Map<String, dynamic> json) {
    return ContentItem(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      type: json['type'] ?? 'text',
      title: json['title'] ?? '',
      description: json['description'],
      url: json['url'],
      content: json['content'],
      durationMinutes: json['duration_minutes'] ?? json['durationMinutes'] ?? 0,
      order: json['order'] ?? 0,
      isRequired: json['is_required'] ?? json['isRequired'] ?? true,
      assessmentId: json['assessment_id'] ?? json['assessmentId'],
    );
  }
}

class CourseModule {
  final String id;
  final String title;
  final String? description;
  final int order;
  final List<ContentItem> contentItems;

  const CourseModule({
    required this.id,
    required this.title,
    this.description,
    required this.order,
    required this.contentItems,
  });

  factory CourseModule.fromJson(Map<String, dynamic> json) {
    return CourseModule(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? '',
      description: json['description'],
      order: json['order'] ?? 0,
      contentItems: (json['content_items'] ?? json['contentItems'] ?? const [])
          .whereType<Map>()
          .map<ContentItem>((e) => ContentItem.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }
}

class CourseSummary {
  final String id;
  final String title;
  final String description;
  final String category;
  final String difficulty;
  final int classLevel;
  final String instructorName;
  final String? thumbnailUrl;
  final int moduleCount;
  final int totalContentItems;
  final double averageRating;
  final int totalEnrollments;
  final bool isEnrolled;

  const CourseSummary({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.difficulty,
    required this.classLevel,
    required this.instructorName,
    this.thumbnailUrl,
    required this.moduleCount,
    required this.totalContentItems,
    required this.averageRating,
    required this.totalEnrollments,
    required this.isEnrolled,
  });

  factory CourseSummary.fromJson(Map<String, dynamic> json) {
    return CourseSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? '',
      difficulty: json['difficulty'] ?? 'beginner',
      classLevel: json['class_level'] ?? json['classLevel'] ?? 0,
      instructorName:
          json['instructor_name'] ?? json['instructorName'] ?? 'Instructor',
      thumbnailUrl: json['thumbnail_url'] ?? json['thumbnailUrl'],
      moduleCount: json['module_count'] ?? json['moduleCount'] ?? 0,
      totalContentItems:
          json['total_content_items'] ?? json['totalContentItems'] ?? 0,
      averageRating: (json['average_rating'] ?? json['averageRating'] ?? 0).toDouble(),
      totalEnrollments:
          json['total_enrollments'] ?? json['totalEnrollments'] ?? 0,
      isEnrolled: json['is_enrolled'] ?? json['isEnrolled'] ?? false,
    );
  }
}

class CourseDetail extends CourseSummary {
  final List<CourseModule> modules;

  const CourseDetail({
    required super.id,
    required super.title,
    required super.description,
    required super.category,
    required super.difficulty,
    required super.classLevel,
    required super.instructorName,
    super.thumbnailUrl,
    required super.moduleCount,
    required super.totalContentItems,
    required super.averageRating,
    required super.totalEnrollments,
    required super.isEnrolled,
    required this.modules,
  });

  factory CourseDetail.fromJson(Map<String, dynamic> json) {
    final base = CourseSummary.fromJson(json);
    return CourseDetail(
      id: base.id,
      title: base.title,
      description: base.description,
      category: base.category,
      difficulty: base.difficulty,
      classLevel: base.classLevel,
      instructorName: base.instructorName,
      thumbnailUrl: base.thumbnailUrl,
      moduleCount: base.moduleCount,
      totalContentItems: base.totalContentItems,
      averageRating: base.averageRating,
      totalEnrollments: base.totalEnrollments,
      isEnrolled: base.isEnrolled,
      modules: (json['modules'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => CourseModule.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }
}
