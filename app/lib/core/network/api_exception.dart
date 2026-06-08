import 'package:dio/dio.dart';

/// A typed, user-presentable error raised by the data layer.
///
/// Repositories convert low-level [DioException]s into [ApiException]s so the
/// presentation layer never has to know about Dio. The [message] is safe to
/// show directly in UI (error states, snackbars).
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final bool isNetwork;

  const ApiException(this.message, {this.statusCode, this.isNetwork = false});

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;

  /// Maps any thrown error (typically a [DioException]) to an [ApiException].
  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is! DioException) {
      return ApiException(error.toString());
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(
          'The connection timed out. Please try again.',
          isNetwork: true,
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          'Cannot reach the server. Check your internet connection.',
          isNetwork: true,
        );
      case DioExceptionType.badCertificate:
        return const ApiException('A secure connection could not be established.',
            isNetwork: true);
      case DioExceptionType.cancel:
        return const ApiException('Request cancelled.');
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        final status = error.response?.statusCode;
        final detail = _extractDetail(error.response?.data);
        if (status == 401) {
          return ApiException(detail ?? 'Your session has expired. Please sign in again.',
              statusCode: 401);
        }
        if (status == 403) {
          return ApiException(detail ?? 'You do not have access to this resource.',
              statusCode: 403);
        }
        if (status == 404) {
          return ApiException(detail ?? 'Not found.', statusCode: 404);
        }
        if (status != null && status >= 500) {
          return ApiException(detail ?? 'Something went wrong on the server.',
              statusCode: status);
        }
        return ApiException(
          detail ?? error.message ?? 'Unexpected error. Please try again.',
          statusCode: status,
          isNetwork: error.type == DioExceptionType.unknown,
        );
    }
  }

  /// Pulls a human message out of common FastAPI error envelopes.
  static String? _extractDetail(dynamic data) {
    if (data == null) return null;
    if (data is String && data.trim().isNotEmpty) return data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['error'];
      if (detail is String && detail.trim().isNotEmpty) return detail;
      // FastAPI validation errors: detail is a list of {msg, loc}.
      if (detail is List && detail.isNotEmpty) {
        final first = detail.first;
        if (first is Map && first['msg'] != null) return first['msg'].toString();
      }
    }
    return null;
  }

  @override
  String toString() => message;
}
