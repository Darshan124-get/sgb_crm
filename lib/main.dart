import 'package:flutter/material.dart';
import 'app/app.dart';
import 'app/router/app_router.dart';
import 'core/network/api_client.dart';
import 'core/network/api_config.dart';
import 'core/services/notification_service.dart';
import 'core/storage/session_storage.dart';
import 'features/notifications/data/notifications_storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiConfig.init();
  await SessionStorage.init();
  await NotificationsStorageService.init();
  await NotificationService.initialize();

  ApiClient.onSessionExpired = () {
    final nav = App.navigatorKey.currentState;
    if (nav != null) {
      nav.pushNamedAndRemoveUntil(AppRouter.login, (route) => false);
      final ctx = App.navigatorKey.currentContext;
      if (ctx != null) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.white),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Session expired. Please log in again to continue.',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFFB91C1C),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  };

  runApp(const App());
}
