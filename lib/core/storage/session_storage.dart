import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/domain/models/user_model.dart';

class SessionStorage {
  static const String keyToken = 'auth_token';
  static const String keyUser = 'auth_user';
  static const String keyRememberIdentifier = 'remember_identifier';
  static const String keyRememberMe = 'remember_me';
  static const String keyHasSeenOnboarding = 'has_seen_onboarding';

  static String? _cachedToken;
  static UserModel? _cachedUser;
  static bool _cachedHasSeenOnboarding = false;

  static String? get token => _cachedToken;
  static UserModel? get currentUser => _cachedUser;
  static bool get isLoggedIn => _cachedToken != null && _cachedToken!.isNotEmpty;
  static bool get hasSeenOnboarding => _cachedHasSeenOnboarding;

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _cachedToken = prefs.getString(keyToken);
      _cachedHasSeenOnboarding = prefs.getBool(keyHasSeenOnboarding) ?? false;
      final userJson = prefs.getString(keyUser);
      if (userJson != null && userJson.isNotEmpty) {
        _cachedUser = UserModel.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
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
    required UserModel user,
  }) async {
    _cachedToken = token;
    _cachedUser = user;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyToken, token);
      await prefs.setString(keyUser, jsonEncode(user.toJson()));
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
    _cachedUser = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(keyToken);
      await prefs.remove(keyUser);
    } catch (_) {}
  }
}
