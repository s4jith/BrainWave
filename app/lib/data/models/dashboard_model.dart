/// Aggregated home-screen payload from `GET /api/user/dashboard/{student_id}`.
///
/// Shape (FastAPI `DashboardData`):
/// `{ streak: StreakData, progress: ProgressData,
///    recent_notes: [NoteSummary], total_notes: int }`.
class DashboardModel {
  final StreakData streak;
  final ProgressData progress;
  final List<NoteSummary> recentNotes;
  final int totalNotes;

  const DashboardModel({
    required this.streak,
    required this.progress,
    required this.recentNotes,
    required this.totalNotes,
  });

  factory DashboardModel.fromJson(Map<String, dynamic> json) {
    return DashboardModel(
      streak: StreakData.fromJson(_asMap(json['streak'])),
      progress: ProgressData.fromJson(_asMap(json['progress'])),
      recentNotes: (json['recent_notes'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => NoteSummary.fromJson(e.cast<String, dynamic>()))
          .toList(),
      totalNotes: _int(json['total_notes']),
    );
  }
}

class StreakData {
  final int currentStreak;
  final int longestStreak;
  final String? lastActivityDate;
  final List<DailyActivity> weeklyActivity;

  const StreakData({
    required this.currentStreak,
    required this.longestStreak,
    this.lastActivityDate,
    required this.weeklyActivity,
  });

  factory StreakData.fromJson(Map<String, dynamic> json) {
    return StreakData(
      currentStreak: _int(json['current_streak']),
      longestStreak: _int(json['longest_streak']),
      lastActivityDate: json['last_activity_date']?.toString(),
      weeklyActivity: (json['weekly_activity'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => DailyActivity.fromJson(e.cast<String, dynamic>()))
          .toList(),
    );
  }
}

class DailyActivity {
  final String date;
  final bool active;
  final double hours;

  const DailyActivity(
      {required this.date, required this.active, required this.hours});

  factory DailyActivity.fromJson(Map<String, dynamic> json) {
    final hours = _double(json['hours']);
    return DailyActivity(
      date: (json['date'] ?? json['day'] ?? '').toString(),
      active: json['active'] is bool ? json['active'] : hours > 0,
      hours: hours,
    );
  }
}

class ProgressData {
  final int overallProgress;
  final int totalTests;
  final int completedTests;
  final int totalChapters;
  final int completedChapters;
  final double averageScore;

  const ProgressData({
    required this.overallProgress,
    required this.totalTests,
    required this.completedTests,
    required this.totalChapters,
    required this.completedChapters,
    required this.averageScore,
  });

  factory ProgressData.fromJson(Map<String, dynamic> json) {
    return ProgressData(
      overallProgress: _int(json['overall_progress']),
      totalTests: _int(json['total_tests']),
      completedTests: _int(json['completed_tests']),
      totalChapters: _int(json['total_chapters']),
      completedChapters: _int(json['completed_chapters']),
      averageScore: _double(json['average_score']),
    );
  }
}

class NoteSummary {
  final String id;
  final String title;
  final String lesson;
  final String date;
  final String subject;

  const NoteSummary({
    required this.id,
    required this.title,
    required this.lesson,
    required this.date,
    required this.subject,
  });

  factory NoteSummary.fromJson(Map<String, dynamic> json) {
    return NoteSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? 'Untitled',
      lesson: json['lesson'] ?? '',
      date: json['date'] ?? '',
      subject: json['subject'] ?? '',
    );
  }
}

// ── shared parse helpers ────────────────────────────────────────────────────
Map<String, dynamic> _asMap(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};
int _int(dynamic v) =>
    v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
double _double(dynamic v) =>
    v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
