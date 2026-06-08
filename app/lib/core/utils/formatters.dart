import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;

/// Shared formatting helpers so screens never hand-roll date/number strings.
class Formatters {
  const Formatters._();

  static final _date = DateFormat('d MMM yyyy');
  static final _dateTime = DateFormat('d MMM yyyy • h:mm a');
  static final _time = DateFormat('h:mm a');

  static String date(DateTime? d) => d == null ? '—' : _date.format(d);
  static String dateTime(DateTime? d) => d == null ? '—' : _dateTime.format(d);
  static String time(DateTime? d) => d == null ? '—' : _time.format(d);

  static String relative(DateTime? d) =>
      d == null ? '' : timeago.format(d, allowFromNow: true);

  /// `MM:SS` (or `H:MM:SS`) for assessment / test countdowns.
  static String duration(int totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    final h = totalSeconds ~/ 3600;
    final m = (totalSeconds % 3600) ~/ 60;
    final s = totalSeconds % 60;
    final mm = m.toString().padLeft(2, '0');
    final ss = s.toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
  }

  static String percent(num value, {int decimals = 0}) =>
      '${value.toStringAsFixed(decimals)}%';

  /// Emoji per subject, used for chips/cards across the app.
  static String subjectEmoji(String subject) {
    switch (subject.toLowerCase()) {
      case 'mathematics':
      case 'math':
      case 'maths':
        return '📐';
      case 'science':
        return '🔬';
      case 'physics':
        return '⚡';
      case 'chemistry':
        return '🧪';
      case 'biology':
        return '🌱';
      case 'social science':
      case 'social studies':
        return '🌍';
      case 'english':
        return '📚';
      case 'hindi':
        return '🔤';
      default:
        return '📖';
    }
  }
}
