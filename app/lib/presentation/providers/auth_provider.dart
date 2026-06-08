import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';

/// Centralised authentication state. Restored from secure storage on launch and
/// updated on login/logout/profile-refresh. The router watches this to gate
/// routes; screens read `user` for ids and profile data.
class AuthState {
  final UserModel? user;
  final bool isLoading; // initial session-restore in flight

  const AuthState({this.user, this.isLoading = false});

  bool get isAuthenticated => user != null;

  AuthState copyWith({UserModel? user, bool? isLoading}) => AuthState(
        user: user ?? this.user,
        isLoading: isLoading ?? this.isLoading,
      );
}

final authProvider =
    NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

class AuthNotifier extends Notifier<AuthState> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _restoreSession();
    return const AuthState(isLoading: true);
  }

  Future<void> _restoreSession() async {
    final token = await _repo.currentToken();
    if (token == null || token.isEmpty) {
      state = const AuthState();
      return;
    }
    try {
      final user = await _repo.getMe();
      state = AuthState(user: user);
    } catch (_) {
      await _repo.logout();
      state = const AuthState();
    }
  }

  /// Throws [ApiException] on failure — the caller (login screen) surfaces it.
  Future<void> login(String email, String password) async {
    final result = await _repo.login(email, password);
    state = AuthState(user: result.user);
  }

  Future<void> refresh() async {
    try {
      state = state.copyWith(user: await _repo.getMe());
    } catch (_) {
      // keep current user on a transient refresh failure
    }
  }

  void setUser(UserModel user) => state = AuthState(user: user);

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthState();
  }
}
