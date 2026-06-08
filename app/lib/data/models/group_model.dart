/// A class/group the student belongs to, from `/api/student/groups`.
class GroupModel {
  final String id;
  final String name;
  final String teacherName;
  final String subject;
  final String classLevel;
  final int studentCount;
  final String? description;

  const GroupModel({
    required this.id,
    required this.name,
    required this.teacherName,
    required this.subject,
    required this.classLevel,
    required this.studentCount,
    this.description,
  });

  factory GroupModel.fromJson(Map<String, dynamic> json) {
    return GroupModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: json['name'] ?? json['group_name'] ?? 'Group',
      teacherName: json['teacher_name'] ??
          json['teacherName'] ??
          json['teacher'] ??
          'Teacher',
      subject: json['subject'] ?? '',
      classLevel: (json['class_level'] ?? json['classLevel'] ?? '').toString(),
      studentCount: json['student_count'] ??
          json['studentCount'] ??
          (json['students'] is List ? (json['students'] as List).length : 0),
      description: json['description'],
    );
  }
}
