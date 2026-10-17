import 'package:shared_preferences/shared_preferences.dart';

/// Centralized API configuration for SGB Connect mobile app.
/// Production backend hosted on Hostinger.
class ApiConfig {
  static const String keyCustomBaseUrl = 'custom_backend_base_url';

  /// Production host
  static const String productionUrl = 'https://paleturquoise-elk-361855.hostingersite.com/api';

  /// Default production URL
  static String get defaultBaseUrl => productionUrl;

  /// Candidate hosts locked to production backend
  static List<String> get candidateHosts => const [productionUrl];

  static String _activeBaseUrl = productionUrl;

  static String get baseUrl {
    if (_activeBaseUrl.isNotEmpty) return _activeBaseUrl;
    return defaultBaseUrl;
  }

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final custom = prefs.getString(keyCustomBaseUrl);
      // If SharedPreferences has an old local/private LAN IP, discard it and use productionUrl
      if (custom != null &&
          custom.trim().isNotEmpty &&
          !custom.contains('192.168.') &&
          !custom.contains('10.77.') &&
          !custom.contains('10.0.2.2') &&
          !custom.contains('127.0.0.1')) {
        _activeBaseUrl = custom.trim();
      } else {
        _activeBaseUrl = defaultBaseUrl;
        if (custom != null) {
          await prefs.remove(keyCustomBaseUrl);
        }
      }
    } catch (_) {
      _activeBaseUrl = defaultBaseUrl;
    }
  }

  static Future<void> setBaseUrl(String url) async {
    _activeBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    if (!_activeBaseUrl.endsWith('/api') && !_activeBaseUrl.contains('/api/')) {
      _activeBaseUrl = '$_activeBaseUrl/api';
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyCustomBaseUrl, _activeBaseUrl);
    } catch (_) {}
  }

  static Future<void> resetToDefault() async {
    _activeBaseUrl = defaultBaseUrl;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(keyCustomBaseUrl);
    } catch (_) {}
  }
}
