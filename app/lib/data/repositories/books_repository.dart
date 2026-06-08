import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../core/network/api_client.dart';
import '../models/lesson_model.dart';

final booksRepositoryProvider =
    Provider<BooksRepository>((ref) => BooksRepository(ref.read(apiClientProvider)));

/// Student book-reading endpoints powering BookToBot
/// (`/api/books/student/*`).
class BooksRepository {
  final ApiClient _client;
  BooksRepository(this._client);

  /// AI-ready subjects come first; falls back to all subjects if none are
  /// embedding-ready (mirrors the web BookToBot behaviour).
  Future<List<SubjectInfo>> getSubjects(int classLevel) async {
    final res = await _client.get('/api/books/student/subjects',
        queryParameters: {'class_level': classLevel});
    final all = Json.list(res.data, ['subjects']).map(SubjectInfo.fromJson).toList();
    final aiReady = all.where((s) => s.hasAiSupport).toList();
    return aiReady.isNotEmpty ? aiReady : all;
  }

  Future<List<LessonModel>> getLessons({
    required int classLevel,
    required String subject,
  }) async {
    final res = await _client.get('/api/books/student/lessons',
        queryParameters: {'class_level': classLevel, 'subject': subject});
    return Json.list(res.data, ['lessons'])
        .map(LessonModel.fromJson)
        .map((l) => l.copyWith(pdfUrl: _absoluteUrl(l.pdfUrl)))
        .toList();
  }

  /// Downloads a lesson PDF as bytes for the on-device viewer.
  Future<Uint8List> downloadPdf(String url) => _client.getBytes(url);

  /// Cloudinary URLs are already absolute; relative paths are joined to the API
  /// origin so [pdfx] can fetch them over the network.
  String _absoluteUrl(String url) {
    if (url.isEmpty || url.startsWith('http')) return url;
    final base = AppConstants.apiBaseUrl;
    return url.startsWith('/') ? '$base$url' : '$base/$url';
  }
}
