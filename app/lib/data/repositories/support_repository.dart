import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../models/support_model.dart';

final supportRepositoryProvider = Provider<SupportRepository>(
    (ref) => SupportRepository(ref.read(apiClientProvider)));

/// Support ticket endpoints (`/api/support-tickets`).
///
/// The backend filters a student's tickets by `created_by == user_id`, so the
/// same [userId] must be passed on create, list and reply.
class SupportRepository {
  final ApiClient _client;
  SupportRepository(this._client);

  Future<List<SupportTicket>> getTickets(String userId) async {
    final res = await _client.get('/api/support-tickets/',
        queryParameters: {'user_id': userId, 'is_admin': false});
    return Json.list(res.data, ['tickets']).map(SupportTicket.fromJson).toList();
  }

  Future<SupportTicket> createTicket({
    required String userId,
    required String userName,
    required String title,
    required String description,
    String category = 'general',
    String priority = 'medium',
  }) async {
    final res = await _client.post(
      '/api/support-tickets/',
      queryParameters: {'user_id': userId, 'user_name': userName},
      data: {
        'title': title,
        'description': description,
        'category': category,
        'priority': priority,
      },
    );
    return SupportTicket.fromJson(Json.map(res.data));
  }

  Future<SupportTicket> getTicket(String ticketId) async {
    final res = await _client.get('/api/support-tickets/$ticketId');
    return SupportTicket.fromJson(Json.map(res.data));
  }

  Future<void> reply({
    required String ticketId,
    required String message,
    required String authorName,
  }) async {
    await _client.post('/api/support-tickets/$ticketId/reply', data: {
      'message': message,
      'is_admin': false,
      'author_name': authorName,
    });
  }
}
