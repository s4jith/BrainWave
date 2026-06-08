import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/test_model.dart';
import '../../data/repositories/test_repository.dart';
import '../providers/auth_provider.dart';

/// Past test attempts for the signed-in student.
final testHistoryProvider =
    FutureProvider.autoDispose<List<TestHistoryItem>>((ref) async {
  final user = ref.watch(authProvider).user;
  if (user == null) return const [];
  return ref.read(testRepositoryProvider).getHistory(user.userId);
});
