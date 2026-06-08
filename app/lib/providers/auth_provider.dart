import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/api_client.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(const AuthState(isLoading: true)) {
    _tryRestoreSession();
  }

  Future<void> _tryRestoreSession() async {
    final token = await ApiClient.getToken();
    if (token == null) {
      state = const AuthState();
      return;
    }
    try {
      final user = await _authService.getMe();
      state = AuthState(user: user, token: token);
    } catch (_) {
      await ApiClient.clearToken();
      state = const AuthState();
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _authService.login(email, password);
      state = AuthState(
        user: result['user'] as UserModel,
        token: result['token'] as String,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState();
  }

  Future<void> refreshUser() async {
    try {
      final user = await _authService.getMe();
      state = state.copyWith(user: user);
    } catch (_) {}
  }

  void clearError() => state = state.copyWith(error: null);

  String _extractError(dynamic e) {
    final msg = e.toString();
    if (msg.contains('401') || msg.contains('Unauthorized')) {
      return 'Invalid email or password';
    }
    if (msg.contains('connection') || msg.contains('Connection')) {
      return 'Cannot connect to server. Check your network.';
    }
    if (msg.contains('detail')) {
      final match = RegExp(r'"detail":"([^"]+)"').firstMatch(msg);
      if (match != null) return match.group(1)!;
    }
    return 'Login failed. Please try again.';
  }
}
