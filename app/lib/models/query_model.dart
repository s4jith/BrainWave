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
      id: json['_id'] ?? json['id'] ?? '',
      studentId: json['student_id'] ?? json['studentId'] ?? '',
      question: json['question'] ?? '',
      subject: json['subject'] ?? '',
      status: json['status'] ?? 'pending',
      answer: json['answer'],
      answeredBy: json['answered_by'] ?? json['answeredBy'],
      createdAt: DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ?? DateTime.now(),
      answeredAt: json['answered_at'] != null
          ? DateTime.tryParse(json['answered_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'question': question,
    'subject': subject,
  };
}

class GradeModel {
  final String id;
  final String subject;
  final String courseName;
  final double grade;
  final String letterGrade;
  final int totalAssignments;
  final int completedAssignments;
  final DateTime updatedAt;

  const GradeModel({
    required this.id,
    required this.subject,
    required this.courseName,
    required this.grade,
    required this.letterGrade,
    required this.totalAssignments,
    required this.completedAssignments,
    required this.updatedAt,
  });

  factory GradeModel.fromJson(Map<String, dynamic> json) {
    return GradeModel(
      id: json['_id'] ?? json['id'] ?? '',
      subject: json['subject'] ?? '',
      courseName: json['course_name'] ?? json['courseName'] ?? json['subject'] ?? '',
      grade: (json['grade'] ?? 0).toDouble(),
      letterGrade: json['letter_grade'] ?? json['letterGrade'] ?? '-',
      totalAssignments: json['total_assignments'] ?? json['totalAssignments'] ?? 0,
      completedAssignments: json['completed_assignments'] ?? json['completedAssignments'] ?? 0,
      updatedAt: DateTime.tryParse(json['updated_at'] ?? json['updatedAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class GroupModel {
  final String id;
  final String name;
  final String teacherName;
  final String subject;
  final String classLevel;
  final int studentCount;

  const GroupModel({
    required this.id,
    required this.name,
    required this.teacherName,
    required this.subject,
    required this.classLevel,
    required this.studentCount,
  });

  factory GroupModel.fromJson(Map<String, dynamic> json) {
    return GroupModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      teacherName: json['teacher_name'] ?? json['teacherName'] ?? '',
      subject: json['subject'] ?? '',
      classLevel: json['class_level'] ?? json['classLevel'] ?? '',
      studentCount: json['student_count'] ?? json['studentCount'] ?? 0,
    );
  }
}
