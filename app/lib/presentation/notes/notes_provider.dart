import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/note_model.dart';
import '../../data/repositories/notes_repository.dart';
import '../providers/auth_provider.dart';

/// Owns the student's notes list and its create/update/delete mutations.
final notesProvider =
    AsyncNotifierProvider.autoDispose<NotesNotifier, List<NoteModel>>(
        NotesNotifier.new);

class NotesNotifier extends AutoDisposeAsyncNotifier<List<NoteModel>> {
  NotesRepository get _repo => ref.read(notesRepositoryProvider);
  String get _studentId => ref.read(authProvider).user?.userId ?? '';

  @override
  Future<List<NoteModel>> build() => _repo.getNotes(_studentId);

  Future<void> add({
    required String title,
    required String content,
    String subject = '',
    String chapter = '',
  }) async {
    final classLevel = ref.read(authProvider).user?.classLevel ?? '';
    await _repo.createNote(
      studentId: _studentId,
      title: title,
      content: content,
      subject: subject,
      chapter: chapter,
      classLevel: classLevel,
    );
    ref.invalidateSelf();
    await future;
  }

  Future<void> edit(
      {required String id,
      required String title,
      required String content}) async {
    await _repo.updateNote(id, title: title, content: content);
    ref.invalidateSelf();
    await future;
  }

  /// Optimistically removes the note, restoring it if the request fails.
  Future<void> remove(String id) async {
    final prev = state.valueOrNull ?? const [];
    state = AsyncData(prev.where((n) => n.id != id).toList());
    try {
      await _repo.deleteNote(id);
    } catch (e) {
      state = AsyncData(prev);
      rethrow;
    }
  }
}
