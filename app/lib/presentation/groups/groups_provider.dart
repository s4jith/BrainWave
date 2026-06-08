import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/group_model.dart';
import '../../data/repositories/student_repository.dart';

/// Class groups the student belongs to.
final groupsProvider = FutureProvider.autoDispose<List<GroupModel>>((ref) {
  return ref.read(studentRepositoryProvider).getGroups();
});
