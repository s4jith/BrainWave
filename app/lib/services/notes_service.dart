import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/note_model.dart';
import 'api_client.dart';

final notesServiceProvider = Provider((ref) => NotesService(ref.read(apiClientProvider)));

class NotesService {
  final ApiClient _client;
  NotesService(this._client);

  Future<List<NoteModel>> getNotes(String studentId, {String? subject, String? chapter}) async {
    final params = <String, dynamic>{};
    if (subject != null) params['subject'] = subject;
    if (chapter != null) params['chapter'] = chapter;

    final response = await _client.get(
      '/api/notes/$studentId',
      queryParameters: params.isNotEmpty ? params : null,
    );
    final data = response.data;
    List<dynamic> list = [];
    if (data is List) list = data;
    else if (data is Map && data['notes'] is List) list = data['notes'];
    return list.map((j) => NoteModel.fromJson(j)).toList();
  }

  Future<NoteModel> createNote(NoteModel note, String studentId) async {
    final payload = note.toJson();
    payload['student_id'] = studentId;
    final response = await _client.post('/api/notes/', data: payload);
    return NoteModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<NoteModel> updateNote(String noteId, String title, String content) async {
    final response = await _client.patch(
      '/api/notes/$noteId',
      data: {'title': title, 'content': content},
    );
    return NoteModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteNote(String noteId) async {
    await _client.delete('/api/notes/$noteId');
  }
}
