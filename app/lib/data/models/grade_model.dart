/// A per-course / per-subject grade row from `/api/gradebook/my-grades`.
/// The analytics service returns a flexible shape, so parsing is defensive.
class GradeModel {
  final String id;
  final String subject;
  final String courseName;
  final String? courseId;
  final double percentage;
  final String letterGrade;
  final int totalAssignments;
  final int completedAssignments;
  final DateTime? updatedAt;

  const GradeModel({
    required this.id,
    required this.subject,
    required this.courseName,
    this.courseId,
    required this.percentage,
    required this.letterGrade,
    required this.totalAssignments,
    required this.completedAssignments,
    this.updatedAt,
  });

  factory GradeModel.fromJson(Map<String, dynamic> json) {
    double num0(List<String> keys) {
      for (final k in keys) {
        final v = json[k];
        if (v is num) return v.toDouble();
        final p = double.tryParse('${v ?? ''}');
        if (p != null) return p;
      }
      return 0;
    }

    int int0(List<String> keys) {
      for (final k in keys) {
        final v = json[k];
        if (v is num) return v.toInt();
        final p = int.tryParse('${v ?? ''}');
        if (p != null) return p;
      }
      return 0;
    }

    final pct = num0(['percentage', 'grade', 'score', 'average', 'overall']);
    return GradeModel(
      id: (json['_id'] ?? json['id'] ?? json['course_id'] ?? '').toString(),
      subject: json['subject'] ?? json['category'] ?? '',
      courseName: json['course_name'] ??
          json['courseName'] ??
          json['course_title'] ??
          json['title'] ??
          json['subject'] ??
          'Course',
      courseId: (json['course_id'] ?? json['courseId'])?.toString(),
      percentage: pct,
      letterGrade: (json['letter_grade'] ??
              json['letterGrade'] ??
              json['letter'] ??
              _letterFor(pct))
          .toString(),
      totalAssignments:
          int0(['total_assignments', 'totalAssignments', 'total', 'total_count']),
      completedAssignments: int0([
        'completed_assignments',
        'completedAssignments',
        'graded_count',
        'completed'
      ]),
      updatedAt:
          DateTime.tryParse('${json['updated_at'] ?? json['updatedAt'] ?? ''}')
              ?.toLocal(),
    );
  }

  static String _letterFor(double pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    if (pct > 0) return 'F';
    return '—';
  }
}
