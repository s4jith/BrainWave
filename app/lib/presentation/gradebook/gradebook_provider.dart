import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/gradebook_repository.dart';

/// Student gradebook (overall + per-course breakdown).
final gradebookProvider =
    FutureProvider.autoDispose<GradebookResult>((ref) {
  return ref.read(gradebookRepositoryProvider).getMyGrades();
});
