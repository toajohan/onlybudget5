import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

/// Talks to the same Next.js API the web app uses (https://onlybudget-app.vercel.app). Auth works exactly like a
/// browser: the login response's Set-Cookie is captured and stored, then replayed as a `Cookie` header on every
/// request — no backend change needed, `getCurrentUser()` server-side reads the same cookie either way.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const String baseUrl = 'https://onlybudget-app.vercel.app';
  static const _cookieChannel = MethodChannel('onlybudget/cookies');

  final _storage = const FlutterSecureStorage();
  static const _cookieKey = 'onlybudget_session_cookie';

  String? _cookie;
  bool _loaded = false;

  /// Called whenever a request comes back 401/307 (expired or missing session) — lets the app pop back to login.
  void Function()? onUnauthorized;

  Future<void> _ensureLoaded() async {
    if (!_loaded) {
      _cookie = await _storage.read(key: _cookieKey);
      _loaded = true;
    }
    await _syncFromWebView();
  }

  /// The WebView's cookie store is the source of truth for who's signed in (the user logs in and out on the real
  /// site). Only reachable from the main isolate: background isolates (FCM, WorkManager) keep the stored copy.
  Future<void> _syncFromWebView() async {
    String? raw;
    try {
      raw = await _cookieChannel.invokeMethod<String>('get', {'url': baseUrl});
    } catch (_) {
      return;
    }
    final match = raw == null ? null : RegExp(r'(?:^|;\s*)(session=[^;]+)').firstMatch(raw);
    if (match != null) {
      await setRawCookie(match.group(1)!);
    } else if (_cookie != null) {
      await clearSession();
    }
  }

  Future<bool> hasSession() async {
    await _ensureLoaded();
    return _cookie != null;
  }

  Future<void> _captureCookie(http.Response res) async {
    final raw = res.headers['set-cookie'];
    if (raw == null) return;
    final match = RegExp(r'session=[^;]+').firstMatch(raw);
    if (match == null) return;
    await setRawCookie(match.group(0)!);
  }

  /// No-ops if the value is unchanged (avoids a storage write on every check).
  Future<void> setRawCookie(String sessionCookiePair) async {
    if (_cookie == sessionCookiePair) return;
    _cookie = sessionCookiePair;
    await _storage.write(key: _cookieKey, value: _cookie);
  }

  Future<void> clearSession() async {
    _cookie = null;
    _loaded = true;
    await _storage.delete(key: _cookieKey);
  }

  Map<String, String> _headers({bool json = true}) {
    final h = <String, String>{if (json) 'Content-Type': 'application/json'};
    if (_cookie != null) h['Cookie'] = _cookie!;
    return h;
  }

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Future<dynamic> _handle(http.Response res, {bool captureCookie = false}) async {
    if (captureCookie) await _captureCookie(res);
    if (res.statusCode == 307 || res.statusCode == 401) {
      onUnauthorized?.call();
      throw ApiException('Session expirée, reconnectez-vous.', statusCode: res.statusCode);
    }
    Map<String, dynamic>? body;
    try {
      if (res.body.isNotEmpty) body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      // Non-JSON body (e.g. an HTML error page) — fall through to the generic message below.
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(body?['error'] as String? ?? 'Erreur réseau (${res.statusCode}).', statusCode: res.statusCode);
    }
    return body;
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    await _ensureLoaded();
    final res = await http.get(_uri(path, query), headers: _headers(json: false)).timeout(const Duration(seconds: 20));
    return _handle(res);
  }

  Future<dynamic> post(String path, {Object? body, bool captureCookie = false}) async {
    await _ensureLoaded();
    final res = await http
        .post(_uri(path), headers: _headers(), body: body == null ? null : jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _handle(res, captureCookie: captureCookie);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    await _ensureLoaded();
    final res = await http
        .patch(_uri(path), headers: _headers(), body: body == null ? null : jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _handle(res);
  }

  Future<dynamic> delete(String path, {Object? body}) async {
    await _ensureLoaded();
    final res = await http
        .delete(_uri(path), headers: _headers(json: body != null), body: body == null ? null : jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _handle(res);
  }
}
