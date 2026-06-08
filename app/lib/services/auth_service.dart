import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import 'api_client.dart';

final authServiceProvider = Provider((ref) => AuthService(ref.read(apiClientProvider)));

class AuthService {
  final ApiClient _client;
  AuthService(this._client);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post(
      '/api/auth/login',
      data: {'email': email, 'password': password},
    );
    final data = response.data as Map<String, dynamic>;
    final token = data['access_token'] as String;
    await ApiClient.saveToken(token);

    final userJson = data['user'] ?? data;
    return {'token': token, 'user': UserModel.fromJson(userJson)};
  }

  Future<UserModel> getMe() async {
    final response = await _client.get('/api/auth/me');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
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
  }) async {
    await _client.post('/api/auth/complete-onboarding', data: {
      'user_id': userId,
      'profile': {
        'name': name,
        'classLevel': classLevel,
      },
    });
  }

  Future<void> logout() async {
    await ApiClient.clearToken();
  }
}
