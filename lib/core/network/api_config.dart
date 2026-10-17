import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized API configuration for SGB Connect mobile app.
/// Matches the web portal modular backend running on port 5000.
class ApiConfig {
  static const String keyCustomBaseUrl = 'custom_backend_base_url';

  /// Standard default hosts
  static const String localhostUrl = 'http://127.0.0.1:5000/api';
  static const String androidEmulatorUrl = 'http://10.0.2.2:5000/api';
  static const String currentWifiLanUrl = 'http://10.77.194.13:5000/api';
  static const String hotspotLanUrl = 'http://192.168.137.1:5000/api';
  static const String legacyLanUrl = 'http://192.168.1.120:5000/api';

  /// Primary local LAN host (points to current active host PC Wi-Fi IP)
  static const String localLanUrl = currentWifiLanUrl;

  /// Candidate hosts to try in priority order
  static List<String> get candidateHosts => [
    currentWifiLanUrl, // http://10.77.194.13:5000/api (Current Wi-Fi LAN IP)
    hotspotLanUrl, // http://192.168.137.1:5000/api (Windows Mobile Hotspot)
    legacyLanUrl, // http://192.168.1.120:5000/api (Alternate / Previous Wi-Fi LAN IP)
    androidEmulatorUrl, // http://10.0.2.2:5000/api (Android Emulator)
    localhostUrl, // http://127.0.0.1:5000/api (Desktop / Web / Test)
  ];

  /// Auto-detected default depending on current platform
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return localhostUrl;
    }
    try {
      if (Platform.isAndroid) {
        // Physical phones on local Wi-Fi connect via the host PC LAN IP
        return currentWifiLanUrl;
      }
    } catch (_) {}
    return localhostUrl;
  }

  static String _activeBaseUrl = '';

  static String get baseUrl {
    if (_activeBaseUrl.isNotEmpty) return _activeBaseUrl;
    return defaultBaseUrl;
  }

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final custom = prefs.getString(keyCustomBaseUrl);
      if (custom != null && custom.trim().isNotEmpty) {
        _activeBaseUrl = custom.trim();
      } else {
        _activeBaseUrl = defaultBaseUrl;
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
