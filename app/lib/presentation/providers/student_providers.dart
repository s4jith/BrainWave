import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../data/models/dashboard_model.dart';
import '../../data/repositories/student_repository.dart';
import 'auth_provider.dart';

/// Aggregated dashboard payload for the signed-in student.
final dashboardProvider =
    FutureProvider.autoDispose<DashboardModel>((ref) async {
  final user = ref.watch(authProvider).user;
  if (user == null) throw const ApiException('You are not signed in.');
  return ref.read(studentRepositoryProvider).getDashboard(user.userId);
});

/// Progress summary used by the report card.
final progressProvider = FutureProvider.autoDispose<ProgressData>((ref) async {
  final user = ref.watch(authProvider).user;
  if (user == null) throw const ApiException('You are not signed in.');
  return ref.read(studentRepositoryProvider).getProgress(user.userId);
});

/// Feature flags gating optional areas. Defaults to "all enabled" if the call
/// fails, so a flags outage never hides core navigation.
final featuresProvider = FutureProvider<Map<String, bool>>((ref) async {
  try {
    return await ref.read(studentRepositoryProvider).getFeatures();
  } catch (_) {
    return const <String, bool>{};
  }
});
