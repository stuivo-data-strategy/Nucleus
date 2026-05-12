import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String _defaultBaseUrl = 'http://localhost:3001';

  final String baseUrl;
  final http.Client _client;
  String? _currentUserId;

  ApiClient({
    String? baseUrl,
    http.Client? client,
  })  : baseUrl = baseUrl ?? const String.fromEnvironment(
            'API_BASE_URL',
            defaultValue: _defaultBaseUrl,
          ),
        _client = client ?? http.Client();

  String? get currentUserId => _currentUserId;

  void setCurrentUser(String userId) {
    _currentUserId = userId;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_currentUserId != null) 'x-user-id': _currentUserId!,
      };

  String _url(String path) => '$baseUrl/api/v1$path';

  Future<Map<String, dynamic>> get(String path,
      {Map<String, String>? queryParams}) async {
    final uri = Uri.parse(_url(path)).replace(queryParameters: queryParams);
    final response = await _client.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> post(String path,
      {Map<String, dynamic>? body}) async {
    final response = await _client.post(
      Uri.parse(_url(path)),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> patch(String path,
      {Map<String, dynamic>? body}) async {
    final response = await _client.patch(
      Uri.parse(_url(path)),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return {};
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(
      statusCode: response.statusCode,
      message: response.body,
    );
  }

  void dispose() {
    _client.close();
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
