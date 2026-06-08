import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../data/models/support_model.dart';
import '../../data/repositories/support_repository.dart';
import '../providers/auth_provider.dart';

/// The student's support tickets, with create + reply mutations.
final supportTicketsProvider = AsyncNotifierProvider.autoDispose<
    SupportTicketsNotifier, List<SupportTicket>>(SupportTicketsNotifier.new);

class SupportTicketsNotifier
    extends AutoDisposeAsyncNotifier<List<SupportTicket>> {
  SupportRepository get _repo => ref.read(supportRepositoryProvider);

  @override
  Future<List<SupportTicket>> build() async {
    final user = ref.read(authProvider).user;
    if (user == null) throw const ApiException('You are not signed in.');
    return _repo.getTickets(user.userId);
  }

  Future<void> create({
    required String title,
    required String description,
    required String category,
    required String priority,
  }) async {
    final user = ref.read(authProvider).user;
    if (user == null) throw const ApiException('You are not signed in.');
    await _repo.createTicket(
      userId: user.userId,
      userName: user.name,
      title: title,
      description: description,
      category: category,
      priority: priority,
    );
    ref.invalidateSelf();
    await future;
  }

  Future<void> reply(String ticketId, String message) async {
    final user = ref.read(authProvider).user;
    if (user == null) throw const ApiException('You are not signed in.');
    await _repo.reply(
        ticketId: ticketId, message: message, authorName: user.name);
    ref.invalidate(supportTicketProvider(ticketId));
    ref.invalidateSelf();
  }
}

/// A single ticket with its full reply thread.
final supportTicketProvider =
    FutureProvider.autoDispose.family<SupportTicket, String>((ref, id) {
  return ref.read(supportRepositoryProvider).getTicket(id);
});
