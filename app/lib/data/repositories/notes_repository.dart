import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/note_model.dart';

final notesRepositoryProvider =
    Provider<NotesRepository>((ref) => NotesRepository(ref.read(apiClientProvider)));

/// Student notes CRUD (`/api/notes`).
class NotesRepository {
  final ApiClient _client;
  NotesRepository(this._client);

  Future<List<NoteModel>> getNotes(
    String studentId, {
    String? subject,
    String? chapter,
  }) async {
    final params = <String, dynamic>{};
    if (subject != null && subject.isNotEmpty) params['subject'] = subject;
    if (chapter != null && chapter.isNotEmpty) params['chapter'] = chapter;
    final res = await _client.get('/api/notes/$studentId',
        queryParameters: params.isEmpty ? null : params);
    return Json.list(res.data, ['notes']).map(NoteModel.fromJson).toList();
  }

  Future<NoteModel> createNote({
    required String studentId,
    required String title,
    required String content,
    String subject = '',
    String chapter = '',
    String classLevel = '',
  }) async {
    final res = await _client.post('/api/notes/', data: {
      'student_id': studentId,
      'title': title,
      'content': content,
      'subject': subject,
      'chapter': chapter,
      'class_level': classLevel,
      'note_type': 'manual',
    });
    return NoteModel.fromJson(Json.map(res.data));
  }

  Future<NoteModel> updateNote(
    String noteId, {
    required String title,
    required String content,
  }) async {
    final res = await _client.patch('/api/notes/$noteId',
        data: {'title': title, 'content': content});
    return NoteModel.fromJson(Json.map(res.data));
  }

  Future<void> deleteNote(String noteId) async {
    await _client.delete('/api/notes/$noteId');
  }
}
