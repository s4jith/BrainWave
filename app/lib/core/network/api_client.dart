import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants.dart';
import 'api_exception.dart';

const _storage = FlutterSecureStorage();
const _tokenKey = 'access_token';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Thin transport layer over Dio.
///
/// - Injects the bearer token from secure storage on every request.
/// - Converts all transport/HTTP failures into [ApiException]s, so repositories
///   and the UI never deal with raw [DioException]s.
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
        headers: {'Content-Type': 'application/json'},
        // We validate status ourselves so non-2xx still throws a DioException
        // that ApiException.from() can translate uniformly.
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: _tokenKey);
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) =>
      _guard(() => _dio.get(path, queryParameters: queryParameters));

  Future<Response> post(String path,
          {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) =>
      _guard(() => _dio.post(path,
          data: data, queryParameters: queryParameters, options: options));

  Future<Response> put(String path, {dynamic data}) =>
      _guard(() => _dio.put(path, data: data));

  Future<Response> patch(String path, {dynamic data}) =>
      _guard(() => _dio.patch(path, data: data));

  Future<Response> delete(String path, {dynamic data}) =>
      _guard(() => _dio.delete(path, data: data));

  Future<Response> postFormData(String path, FormData formData) => _guard(
      () => _dio.post(path,
          data: formData,
          options: Options(contentType: 'multipart/form-data')));

  /// Downloads raw bytes (e.g. a PDF). [url] may be absolute (Cloudinary) or a
  /// path relative to the API origin.
  Future<Uint8List> getBytes(String url) async {
    final res = await _guard(() => _dio.get<List<int>>(
          url,
          options: Options(responseType: ResponseType.bytes),
        ));
    return Uint8List.fromList(res.data ?? const []);
  }

  Future<Response> _guard(Future<Response> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  // ── Token helpers ─────────────────────────────────────────────────────────
  static Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  static Future<String?> getToken() => _storage.read(key: _tokenKey);

  static Future<void> clearToken() => _storage.delete(key: _tokenKey);
}

/// JSON shape helpers shared by repositories. Backend list endpoints variously
/// return a bare `List`, or a `{ "<key>": [...] }` envelope — these normalise both.
class Json {
  const Json._();

  static List<Map<String, dynamic>> list(dynamic data, [List<String> keys = const []]) {
    if (data is List) return data.whereType<Map>().map(_cast).toList();
    if (data is Map) {
      for (final k in keys) {
        final v = data[k];
        if (v is List) return v.whereType<Map>().map(_cast).toList();
      }
      // Fallback: first list value found in the map.
      for (final v in data.values) {
        if (v is List) return v.whereType<Map>().map(_cast).toList();
      }
    }
    return const [];
  }

  static Map<String, dynamic> map(dynamic data) {
    if (data is Map) return _cast(data);
    return const {};
  }

  static Map<String, dynamic> _cast(Map m) =>
      m.map((k, v) => MapEntry(k.toString(), v));
}
