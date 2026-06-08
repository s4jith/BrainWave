import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../models/user_model.dart';

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.read(apiClientProvider)));

/// Authentication + session endpoints (`/api/auth/*`).
class AuthRepository {
  final ApiClient _client;
  AuthRepository(this._client);

  Future<({UserModel user, String token})> login(
      String email, String password) async {
    final res = await _client.post('/api/auth/login',
        data: {'email': email, 'password': password});
    final data = Json.map(res.data);
    final token = (data['access_token'] ?? '').toString();
    if (token.isEmpty) {
      throw const ApiException('Login failed — no access token returned.');
    }
    await ApiClient.saveToken(token);
    final user = UserModel.fromJson(Json.map(data['user'] ?? data));
    return (user: user, token: token);
  }

  Future<UserModel> getMe() async {
    final res = await _client.get('/api/auth/me');
    return UserModel.fromJson(Json.map(res.data));
  }

  Future<void> forgotPassword(String email) async {
    await _client.post('/api/auth/forgot-password', data: {'email': email});
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _client.post('/api/auth/change-password-secure', data: {
      'current_password': currentPassword,
      'new_password': newPassword,
    });
  }

  Future<void> completeOnboarding({
    required String userId,
    required String name,
    required String classLevel,
    List<String> subjects = const [],
  }) async {
    await _client.post('/api/auth/complete-onboarding', data: {
      'user_id': userId,
      'profile': {
        'name': name,
        'classLevel': classLevel,
        if (subjects.isNotEmpty) 'subjects': subjects,
      },
    });
  }

  Future<String?> currentToken() => ApiClient.getToken();

  Future<void> logout() => ApiClient.clearToken();
}
