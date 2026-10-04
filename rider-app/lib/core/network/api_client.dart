/**
 * API Client
 * HTTP client for making API requests
 */

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  static late Dio _dio;
  static const _storage = FlutterSecureStorage();

  static void initialize() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: Duration(milliseconds: AppConfig.connectionTimeout),
        receiveTimeout: Duration(milliseconds: AppConfig.receiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptors
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token
          final token = await _storage.read(key: 'auth_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          if (AppConfig.enableLogging) {
            print('🌐 ${options.method} ${options.path}');
            print('📤 Request: ${options.data}');
          }

          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (AppConfig.enableLogging) {
            print('✅ Response [${response.statusCode}]: ${response.data}');
          }
          return handler.next(response);
        },
        onError: (error, handler) {
          if (AppConfig.enableLogging) {
            print('❌ Error [${error.response?.statusCode}]: ${error.message}');
            print('📥 Error Data: ${error.response?.data}');
          }
          return handler.next(error);
        },
      ),
    );
  }

  // GET request
  static Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } catch (e) {
      rethrow;
    }
  }

  // POST request
  static Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
      );
    } catch (e) {
      rethrow;
    }
  }

  // PATCH request
  static Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await _dio.patch(
        path,
        data: data,
        queryParameters: queryParameters,
      );
    } catch (e) {
      rethrow;
    }
  }

  // DELETE request
  static Future<Response> delete(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await _dio.delete(path, queryParameters: queryParameters);
    } catch (e) {
      rethrow;
    }
  }

  // Upload file
  static Future<Response> uploadFile(
    String path,
    String filePath, {
    String fieldName = 'file',
    Map<String, dynamic>? data,
  }) async {
    try {
      final formData = FormData.fromMap({
        fieldName: await MultipartFile.fromFile(filePath),
        ...?data,
      });

      return await _dio.post(path, data: formData);
    } catch (e) {
      rethrow;
    }
  }

  // Save auth token
  static Future<void> saveToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  // Get auth token
  static Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  // Clear auth token
  static Future<void> clearToken() async {
    await _storage.delete(key: 'auth_token');
  }

  // Handle API errors
  static String getErrorMessage(dynamic error) {
    if (error is DioException) {
      if (error.response != null) {
        final data = error.response!.data;
        if (data is Map && data.containsKey('message')) {
          return data['message'];
        }
      }

      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Connection timeout. Please check your internet connection.';
        case DioExceptionType.badResponse:
          return 'Server error. Please try again later.';
        case DioExceptionType.cancel:
          return 'Request cancelled.';
        default:
          return 'Network error. Please check your connection.';
      }
    }

    return 'An unexpected error occurred.';
  }
}
