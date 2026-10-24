import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../../app/app.dart';
import '../../app/router/app_router.dart';
import '../../features/notifications/data/notifications_storage_service.dart';
import '../../features/notifications/domain/models/app_notification_model.dart';
import '../../features/notifications/presentation/widgets/in_app_notification_banner.dart';
import '../network/api_client.dart';
import '../storage/session_storage.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    final title = message.notification?.title ??
        message.data['title']?.toString() ??
        'New Notification';
    final body = message.notification?.body ??
        message.data['body']?.toString() ??
        '';
    final type = message.data['type']?.toString() ?? 'general';
    final leadId = message.data['leadId']?.toString();

    final notif = AppNotificationModel(
      id: message.messageId ?? DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      body: body,
      type: type,
      leadId: leadId,
      timestamp: DateTime.now(),
      data: message.data,
    );
    await NotificationsStorageService.addNotification(notif);
  } catch (_) {}
}

class NotificationService {
  static bool _isInitialized = false;

  static Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        _handleForegroundMessage(message);
      });

      // User tapped notification from background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleMessageNavigation(message.data);
      });

      // Token refresh listener
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        if (SessionStorage.isLoggedIn) {
          registerDeviceToken(explicitToken: newToken);
        }
      });

      // Check if launched by tapping a notification
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        // Delay slightly until UI is loaded
        Future.delayed(const Duration(milliseconds: 1200), () {
          _handleMessageNavigation(initialMessage.data);
        });
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('Firebase NotificationService initialization notice: $e');
    }
  }

  static Future<bool> requestPermission() async {
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      final isGranted = settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;

      if (isGranted && SessionStorage.isLoggedIn) {
        await registerDeviceToken();
      }

      return isGranted;
    } catch (e) {
      debugPrint('Error requesting notification permission: $e');
      return false;
    }
  }

  static Future<void> registerDeviceToken({String? explicitToken}) async {
    if (!SessionStorage.isLoggedIn) return;

    try {
      final token = explicitToken ?? await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;

      final res = await ApiClient.post(
        '/users/fcm-token',
        body: {
          'token': token,
          'device_type': 'android',
        },
      );

      if (res.isSuccess) {
        debugPrint('✅ FCM Device Token registered successfully on backend.');
      } else {
        debugPrint('⚠️ FCM Token registration warning: ${res.errorMessage}');
      }
    } catch (e) {
      debugPrint('Error registering FCM token: $e');
    }
  }

  static Future<void> unregisterDeviceToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;

      await ApiClient.delete(
        '/users/fcm-token',
        queryParameters: {'token': token},
      );
      debugPrint('FCM Device Token unregistered.');
    } catch (e) {
      debugPrint('Error unregistering FCM token: $e');
    }
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    final title = message.notification?.title ??
        message.data['title']?.toString() ??
        'New Notification';
    final body = message.notification?.body ??
        message.data['body']?.toString() ??
        '';
    final type = message.data['type']?.toString() ?? 'general';
    final leadId = message.data['leadId']?.toString();

    final notif = AppNotificationModel(
      id: message.messageId ?? DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      body: body,
      type: type,
      leadId: leadId,
      timestamp: DateTime.now(),
      data: message.data,
    );

    NotificationsStorageService.addNotification(notif);

    // Show interactive in-app banner toast
    final context = App.navigatorKey.currentContext;
    if (context != null) {
      InAppNotificationBanner.show(
        context,
        notif,
        onTap: () {
          _handleMessageNavigation(message.data);
        },
      );
    }
  }

  static void _handleMessageNavigation(Map<String, dynamic> data) {
    final leadId = data['leadId']?.toString();
    final type = data['type']?.toString();

    if (leadId != null && leadId.isNotEmpty) {
      App.navigatorKey.currentState?.pushNamed(
        AppRouter.leadDetails,
        arguments: leadId,
      );
    } else if (type == 'whatsapp_message') {
      App.navigatorKey.currentState?.pushNamed(AppRouter.whatsapp);
    } else {
      App.navigatorKey.currentState?.pushNamed(AppRouter.notifications);
    }
  }
}
