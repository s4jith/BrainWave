import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/query_model.dart';
import '../../data/repositories/student_repository.dart';

/// Student ↔ teacher Q&A list with an "ask" mutation.
final queriesProvider =
    AsyncNotifierProvider.autoDispose<QueriesNotifier, List<QueryModel>>(
        QueriesNotifier.new);

class QueriesNotifier extends AutoDisposeAsyncNotifier<List<QueryModel>> {
  StudentRepository get _repo => ref.read(studentRepositoryProvider);

  @override
  Future<List<QueryModel>> build() => _repo.getQueries();

  Future<void> ask({required String question, required String subject}) async {
    await _repo.createQuery(question: question, subject: subject);
    ref.invalidateSelf();
    await future;
  }
}
