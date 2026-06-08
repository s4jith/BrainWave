import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../data/models/suggestion_model.dart';
import '../../data/repositories/suggestion_repository.dart';
import '../providers/auth_provider.dart';

/// Student suggestions list with a create mutation. The backend keys
/// suggestions by the Mongo `_id` (`user.id`).
final suggestionsProvider =
    AsyncNotifierProvider.autoDispose<SuggestionsNotifier, List<SuggestionModel>>(
        SuggestionsNotifier.new);

class SuggestionsNotifier
    extends AutoDisposeAsyncNotifier<List<SuggestionModel>> {
  SuggestionRepository get _repo => ref.read(suggestionRepositoryProvider);

  @override
  Future<List<SuggestionModel>> build() async {
    final user = ref.read(authProvider).user;
    if (user == null) throw const ApiException('You are not signed in.');
    return _repo.getMySuggestions(user.id);
  }

  Future<void> submit({
    required String content,
    required String category,
    String subject = '',
  }) async {
    final user = ref.read(authProvider).user;
    if (user == null) throw const ApiException('You are not signed in.');
    await _repo.create(
      studentId: user.id,
      studentName: user.name,
      classLevel: user.classLevelInt ?? 0,
      content: content,
      category: category,
      subject: subject,
      email: user.email,
    );
    ref.invalidateSelf();
    await future;
  }
}
