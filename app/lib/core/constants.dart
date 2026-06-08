import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConstants {
  static String get appName => dotenv.get('APP_NAME', fallback: 'BrainWave');

  static String get apiBaseUrl {
    var url = dotenv.get('API_BASE_URL', fallback: 'http://10.0.2.2:8000');
    // Strip trailing /api — all service paths already include /api/ as a prefix,
    // and Dio concatenates baseUrl + path literally (no URI resolution).
    if (url.endsWith('/api')) url = url.substring(0, url.length - 4);
    return url;
  }

  static String get appEnv =>
      dotenv.get('APP_ENV', fallback: 'development');

  static bool get enablePdfViewer =>
      dotenv.get('ENABLE_PDF_VIEWER', fallback: 'true') == 'true';

  static bool get enableCareerTest =>
      dotenv.get('ENABLE_CAREER_TEST', fallback: 'true') == 'true';

  static bool get enableImageChat =>
      dotenv.get('ENABLE_IMAGE_CHAT', fallback: 'true') == 'true';

  static bool get isProduction => appEnv == 'production';

  static const List<String> subjects = [
    'Mathematics',
    'Science',
    'Physics',
    'Chemistry',
    'Biology',
    'Social Science',
    'English',
    'Hindi',
  ];

  static const List<String> classesList = [
    'Class 5', 'Class 6', 'Class 7',
    'Class 8', 'Class 9', 'Class 10',
  ];

  static const List<String> chatModes = [
    'Simple',
    'Meaning',
    'Story',
    'Example',
    'Summary',
  ];

  static const Map<String, String> chatModeDescriptions = {
    'Simple': 'Easy to understand explanation',
    'Meaning': 'What it really means',
    'Story': 'As an engaging story',
    'Example': 'With real-world examples',
    'Summary': 'Quick summary points',
  };

  static const Map<String, String> chatModeIcons = {
    'Simple': '💡',
    'Meaning': '📖',
    'Story': '📚',
    'Example': '🔍',
    'Summary': '📝',
  };
}
