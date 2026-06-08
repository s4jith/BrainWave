import 'package:flutter_test/flutter_test.dart';
import 'package:brainwave/data/models/user_model.dart';
import 'package:brainwave/data/models/assessment_model.dart';
import 'package:brainwave/data/models/dashboard_model.dart';

void main() {
  group('UserModel.fromJson', () {
    test('parses snake_case login payload and derives class level', () {
      final user = UserModel.fromJson({
        '_id': 'abc123',
        'user_id': '10_00001_20',
        'name': 'Asha Rao',
        'email': 'asha@example.com',
        'class_level': 'Class 10',
        'subjects': ['Mathematics', 'Science'],
        'is_onboarded': true,
      });
      expect(user.id, 'abc123');
      expect(user.userId, '10_00001_20');
      expect(user.classLevelInt, 10);
      expect(user.initials, 'AR');
      expect(user.subjects, hasLength(2));
    });

    test('defaults onboarded to true for restored sessions', () {
      final user = UserModel.fromJson({'name': 'X'});
      expect(user.isOnboarded, isTrue);
    });
  });

  group('AnswerSubmission', () {
    test('serialises only the answered fields', () {
      final mcq = AnswerSubmission(questionId: 'q1', selectedOptionIds: ['o2']);
      expect(mcq.toJson(), {
        'question_id': 'q1',
        'selected_option_ids': ['o2'],
      });
      expect(mcq.isAnswered, isTrue);

      const boolean = AnswerSubmission(questionId: 'q2', answerBool: true);
      expect(boolean.toJson()['answer_bool'], true);

      const empty = AnswerSubmission(questionId: 'q3');
      expect(empty.isAnswered, isFalse);
    });
  });

  group('DashboardModel.fromJson', () {
    test('reads nested streak/progress and tolerates missing fields', () {
      final d = DashboardModel.fromJson({
        'streak': {'current_streak': 5, 'longest_streak': 9},
        'progress': {'average_score': 82.5, 'completed_tests': 4},
        'recent_notes': [
          {'id': 'n1', 'title': 'Photosynthesis', 'subject': 'Biology'}
        ],
        'total_notes': 12,
      });
      expect(d.streak.currentStreak, 5);
      expect(d.progress.averageScore, 82.5);
      expect(d.recentNotes.single.title, 'Photosynthesis');
      expect(d.totalNotes, 12);
    });
  });
}
