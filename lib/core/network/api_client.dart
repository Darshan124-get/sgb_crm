import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../storage/session_storage.dart';
import 'api_config.dart';

class ApiResponse<T> {
  final bool isSuccess;
  final T? data;
  final int statusCode;
  final String? errorMessage;

  const ApiResponse({
    required this.isSuccess,
    this.data,
    required this.statusCode,
    this.errorMessage,
  });

  factory ApiResponse.success(T data, {int statusCode = 200}) {
    return ApiResponse(
      isSuccess: true,
      data: data,
      statusCode: statusCode,
    );
  }

  factory ApiResponse.failure(String message, {int statusCode = 400}) {
    return ApiResponse(
      isSuccess: false,
      statusCode: statusCode,
      errorMessage: message,
    );
  }
}

class ApiClient {
  static final http.Client _client = http.Client();

  static Map<String, String> _buildHeaders({Map<String, String>? extraHeaders}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    final token = SessionStorage.token;
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }

  static Uri _buildUri(String base, String path, [Map<String, dynamic>? queryParameters]) {
    final cleanBase = base.replaceAll(RegExp(r'/+$'), '');
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final fullUrl = '$cleanBase$cleanPath';

    final uri = Uri.parse(fullUrl);
    if (queryParameters != null && queryParameters.isNotEmpty) {
      final stringParams = queryParameters.map(
        (key, value) => MapEntry(key, value?.toString() ?? ''),
      );
      return uri.replace(queryParameters: stringParams);
    }
    return uri;
  }

  static Future<ApiResponse<dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path);

        final response = await _client
            .post(
              uri,
              headers: _buildHeaders(extraHeaders: extraHeaders),
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(timeout);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC (${ApiConfig.baseUrl}).',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check that your phone is on the same Wi-Fi network.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static Future<ApiResponse<dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path, queryParameters);

        final response = await _client
            .get(
              uri,
              headers: _buildHeaders(extraHeaders: extraHeaders),
            )
            .timeout(timeout);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC.',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check Wi-Fi connection.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static Future<ApiResponse<dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path);

        final response = await _client
            .put(
              uri,
              headers: _buildHeaders(extraHeaders: extraHeaders),
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(timeout);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC.',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check Wi-Fi connection.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static Future<ApiResponse<dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path);

        final response = await _client
            .patch(
              uri,
              headers: _buildHeaders(extraHeaders: extraHeaders),
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(timeout);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC.',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check Wi-Fi connection.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static Future<ApiResponse<dynamic>> delete(
    String path, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path, queryParameters);

        final response = await _client
            .delete(
              uri,
              headers: _buildHeaders(extraHeaders: extraHeaders),
            )
            .timeout(timeout);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC.',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check Wi-Fi connection.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static Future<ApiResponse<dynamic>> postMultipart(
    String path, {
    required Map<String, String> fields,
    String? fileField,
    String? filePath,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final candidateUrls = [
      ApiConfig.baseUrl,
      ...ApiConfig.candidateHosts.where((h) => h != ApiConfig.baseUrl),
    ];

    Object? lastError;

    for (final base in candidateUrls) {
      try {
        final uri = _buildUri(base, path);
        final request = http.MultipartRequest('POST', uri);

        final token = SessionStorage.token;
        if (token != null && token.isNotEmpty) {
          request.headers['Authorization'] = 'Bearer $token';
        }
        request.headers['Accept'] = 'application/json';
        if (extraHeaders != null) {
          request.headers.addAll(extraHeaders);
        }

        request.fields.addAll(fields);

        if (fileField != null && filePath != null && filePath.isNotEmpty) {
          final file = File(filePath);
          if (await file.exists()) {
            final multipartFile = await http.MultipartFile.fromPath(fileField, filePath);
            request.files.add(multipartFile);
          }
        }

        final streamedResponse = await request.send().timeout(timeout);
        final response = await http.Response.fromStream(streamedResponse);

        if (base != ApiConfig.baseUrl) {
          await ApiConfig.setBaseUrl(base);
        }

        return _handleResponse(response);
      } catch (e) {
        lastError = e;
        if (e is SocketException || e is TimeoutException) {
          continue;
        }
        break;
      }
    }

    if (lastError is SocketException) {
      return ApiResponse.failure(
        'Cannot reach backend server. Please verify your phone is on the same Wi-Fi as your PC.',
        statusCode: 503,
      );
    } else if (lastError is TimeoutException) {
      return ApiResponse.failure(
        'Connection timed out. Please check Wi-Fi connection.',
        statusCode: 408,
      );
    }
    return ApiResponse.failure('Network error: ${lastError?.toString() ?? "Unknown error"}');
  }

  static ApiResponse<dynamic> _handleResponse(http.Response response) {
    dynamic decoded;
    try {
      decoded = response.body.isNotEmpty ? jsonDecode(response.body) : null;
    } catch (_) {
      decoded = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return ApiResponse.success(decoded, statusCode: response.statusCode);
    }

    String errorMsg = 'Request failed (${response.statusCode})';
    if (decoded is Map<String, dynamic>) {
      errorMsg = decoded['message']?.toString() ??
          decoded['error']?.toString() ??
          errorMsg;
    }

    return ApiResponse.failure(errorMsg, statusCode: response.statusCode);
  }
}
