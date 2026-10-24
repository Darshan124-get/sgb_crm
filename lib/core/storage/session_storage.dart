import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/domain/models/user_model.dart';

class SessionStorage {
  static const String keyToken = 'auth_token';
  static const String keyRefreshToken = 'auth_refresh_token';
  static const String keyUser = 'auth_user';
  static const String keyRememberIdentifier = 'remember_identifier';
  static const String keyRememberMe = 'remember_me';
  static const String keyHasSeenOnboarding = 'has_seen_onboarding';

  static String? _cachedToken;
  static String? _cachedRefreshToken;
  static UserModel? _cachedUser;
  static bool _cachedHasSeenOnboarding = false;

  static String? get token => _cachedToken;
  static String? get refreshToken => _cachedRefreshToken;
  static UserModel? get currentUser => _cachedUser;
  static bool get hasValidRefreshToken =>
      _cachedRefreshToken != null &&
      _cachedRefreshToken!.isNotEmpty &&
      !isTokenExpired(_cachedRefreshToken);

  static bool get isLoggedIn {
    if (_cachedToken != null &&
        _cachedToken!.isNotEmpty &&
        !isTokenExpired(_cachedToken)) {
      return true;
    }
    if (hasValidRefreshToken) {
      return true;
    }
    return false;
  }

  static bool get hasSeenOnboarding => _cachedHasSeenOnboarding;

  static bool isTokenExpired(String? token) {
    if (token == null || token.trim().isEmpty) return true;
    try {
      final parts = token.split('.');
      if (parts.length != 3) {
        return false;
      }
      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      final decodedBytes = base64Url.decode(normalized);
      final decodedString = utf8.decode(decodedBytes);
      final dynamic map = jsonDecode(decodedString);
      if (map is Map<String, dynamic> && map['exp'] != null) {
        final expSeconds = (map['exp'] as num).toInt();
        final expDate = DateTime.fromMillisecondsSinceEpoch(expSeconds * 1000);
        return DateTime.now().isAfter(expDate);
      }
    } catch (_) {
      return true;
    }
    return false;
  }

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _cachedToken = prefs.getString(keyToken);
      _cachedRefreshToken = prefs.getString(keyRefreshToken);
      _cachedHasSeenOnboarding = prefs.getBool(keyHasSeenOnboarding) ?? false;
      final userJson = prefs.getString(keyUser);
      if (userJson != null && userJson.isNotEmpty) {
        _cachedUser = UserModel.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      }

      final isAccessExpired = _cachedToken == null || isTokenExpired(_cachedToken);
      final isRefreshExpired = _cachedRefreshToken == null || isTokenExpired(_cachedRefreshToken);

      if (isAccessExpired && isRefreshExpired) {
        await clearSession();
      }
    } catch (_) {}
  }

  static Future<void> setHasSeenOnboarding(bool seen) async {
    _cachedHasSeenOnboarding = seen;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(keyHasSeenOnboarding, seen);
    } catch (_) {}
  }

  static Future<void> saveSession({
    required String token,
    String? refreshToken,
    required UserModel user,
  }) async {
    _cachedToken = token;
    if (refreshToken != null) {
      _cachedRefreshToken = refreshToken;
    }
    _cachedUser = user;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyToken, token);
      if (refreshToken != null) {
        await prefs.setString(keyRefreshToken, refreshToken);
      }
      await prefs.setString(keyUser, jsonEncode(user.toJson()));
    } catch (_) {}
  }

  static Future<void> updateToken({
    required String token,
    String? refreshToken,
  }) async {
    _cachedToken = token;
    if (refreshToken != null) {
      _cachedRefreshToken = refreshToken;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyToken, token);
      if (refreshToken != null) {
        await prefs.setString(keyRefreshToken, refreshToken);
      }
    } catch (_) {}
  }

  static Future<void> saveRememberMe({
    required bool remember,
    required String identifier,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(keyRememberMe, remember);
      if (remember) {
        await prefs.setString(keyRememberIdentifier, identifier);
      } else {
        await prefs.remove(keyRememberIdentifier);
      }
    } catch (_) {}
  }

  static Future<Map<String, dynamic>> getRememberMe() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final remember = prefs.getBool(keyRememberMe) ?? false;
      final identifier = prefs.getString(keyRememberIdentifier) ?? '';
      return {
        'remember': remember,
        'identifier': identifier,
      };
    } catch (_) {
      return {'remember': false, 'identifier': ''};
    }
  }

  static Future<void> clearSession() async {
    _cachedToken = null;
    _cachedRefreshToken = null;
    _cachedUser = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(keyToken);
      await prefs.remove(keyRefreshToken);
      await prefs.remove(keyUser);
    } catch (_) {}
  }
}
