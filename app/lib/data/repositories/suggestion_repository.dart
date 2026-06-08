import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/suggestion_model.dart';

final suggestionRepositoryProvider = Provider<SuggestionRepository>(
    (ref) => SuggestionRepository(ref.read(apiClientProvider)));

/// Student suggestion/feedback endpoints (`/api/suggestions`).
///
/// `studentId` here is the Mongo `_id` (`user.id`) — the backend looks the user
/// up by `ObjectId(student_id)` on create and filters by it on read.
class SuggestionRepository {
  final ApiClient _client;
  SuggestionRepository(this._client);

  Future<List<SuggestionModel>> getMySuggestions(String studentId) async {
    final res = await _client.get('/api/suggestions/student/$studentId');
    return Json.list(res.data, ['suggestions'])
        .map(SuggestionModel.fromJson)
        .toList();
  }

  Future<void> create({
    required String studentId,
    required String studentName,
    required int classLevel,
    required String content,
    String category = 'general',
    String subject = '',
    String? email,
  }) async {
    await _client.post('/api/suggestions', data: {
      'student_id': studentId,
      'student_name': studentName,
      'class_level': classLevel,
      'category': category,
      'subject': subject,
      'content': content,
      if (email != null) 'email': email,
    });
  }
}
