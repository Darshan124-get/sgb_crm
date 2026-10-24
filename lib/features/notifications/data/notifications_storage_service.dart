import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../domain/models/app_notification_model.dart';

class NotificationsStorageService {
  static const String keyNotifications = 'app_notifications_list';
  static const String keyPermissionPromptShown = 'notification_permission_prompt_shown';
  static const int maxStoredNotifications = 60;

  static final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);
  static final ValueNotifier<List<AppNotificationModel>> notificationsNotifier =
      ValueNotifier<List<AppNotificationModel>>([]);

  static Future<void> init() async {
    try {
      final list = await getNotifications();
      notificationsNotifier.value = list;
      unreadCountNotifier.value = list.where((n) => !n.isRead).length;
    } catch (_) {}
  }

  static Future<List<AppNotificationModel>> getNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(keyNotifications);
      if (raw == null || raw.isEmpty) return [];
      return AppNotificationModel.decodeList(raw);
    } catch (_) {
      return [];
    }
  }

  static Future<void> addNotification(AppNotificationModel notification) async {
    try {
      final current = await getNotifications();
      // Prepend the new notification at the top
      final updated = [notification, ...current];
      if (updated.length > maxStoredNotifications) {
        updated.removeRange(maxStoredNotifications, updated.length);
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyNotifications, AppNotificationModel.encodeList(updated));

      notificationsNotifier.value = updated;
      unreadCountNotifier.value = updated.where((n) => !n.isRead).length;
    } catch (_) {}
  }

  static Future<void> markAsRead(String id) async {
    try {
      final current = await getNotifications();
      final updated = current.map((n) {
        if (n.id == id) {
          return n.copyWith(isRead: true);
        }
        return n;
      }).toList();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyNotifications, AppNotificationModel.encodeList(updated));

      notificationsNotifier.value = updated;
      unreadCountNotifier.value = updated.where((n) => !n.isRead).length;
    } catch (_) {}
  }

  static Future<void> markAllAsRead() async {
    try {
      final current = await getNotifications();
      final updated = current.map((n) => n.copyWith(isRead: true)).toList();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyNotifications, AppNotificationModel.encodeList(updated));

      notificationsNotifier.value = updated;
      unreadCountNotifier.value = 0;
    } catch (_) {}
  }

  static Future<void> clearAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(keyNotifications);

      notificationsNotifier.value = [];
      unreadCountNotifier.value = 0;
    } catch (_) {}
  }

  static Future<bool> hasShownPermissionPrompt() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(keyPermissionPromptShown) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setPermissionPromptShown() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(keyPermissionPromptShown, true);
    } catch (_) {}
  }
}
