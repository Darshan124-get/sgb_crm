import 'package:flutter/material.dart';
import '../../features/auth/presentation/pages/dark_splash_screen.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/onboarding_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/leads/domain/models/lead_detail_model.dart';
import '../../features/leads/domain/models/lead_model.dart';
import '../../features/leads/presentation/pages/lead_details_page.dart';
import '../../features/leads/presentation/pages/leads_page.dart';
import '../../features/orders/presentation/pages/orders_page.dart';
import '../../features/profile/presentation/pages/user_profile_page.dart';
import '../../features/whatsapp/domain/models/whatsapp_model.dart';
import '../../features/whatsapp/presentation/pages/whatsapp_chat_page.dart';
import '../../features/whatsapp/presentation/pages/whatsapp_conversations_page.dart';
import '../../features/calls/presentation/pages/calls_page.dart';
import '../../features/legal/presentation/pages/privacy_policy_page.dart';
import '../../core/storage/session_storage.dart';

class AppRouter {
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String dashboard = '/dashboard';
  static const String leads = '/leads';
  static const String leadDetails = '/lead-details';
  static const String orders = '/orders';
  static const String whatsapp = '/whatsapp';
  static const String whatsappChat = '/whatsapp-chat';
  static const String profile = '/profile';
  static const String privacyPolicy = '/privacy-policy';
  static const String calls = '/calls';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case splash:
        return MaterialPageRoute(
          builder: (context) => DarkSplashScreen(
            onAnimationFinished: () {
              if (SessionStorage.isLoggedIn) {
                Navigator.of(context).pushReplacementNamed(dashboard);
              } else if (SessionStorage.hasSeenOnboarding) {
                Navigator.of(context).pushReplacementNamed(login);
              } else {
                Navigator.of(context).pushReplacementNamed(onboarding);
              }
            },
          ),
        );

      case onboarding:
        return MaterialPageRoute(
          builder: (context) => OnboardingPage(
            onFinished: () async {
              await SessionStorage.setHasSeenOnboarding(true);
              if (context.mounted) {
                Navigator.of(context).pushReplacementNamed(login);
              }
            },
          ),
        );

      case login:
        return MaterialPageRoute(
          builder: (_) => const LoginPage(),
        );

      case dashboard:
        return MaterialPageRoute(
          builder: (_) => const DashboardPage(),
        );

      case leads:
        return MaterialPageRoute(
          builder: (_) => const LeadsPage(),
        );

      case leadDetails:
        LeadDetailModel? detailModel;
        String? leadId;
        if (settings.arguments is LeadDetailModel) {
          detailModel = settings.arguments as LeadDetailModel;
        } else if (settings.arguments is LeadModel) {
          leadId = (settings.arguments as LeadModel).id;
        } else if (settings.arguments is String) {
          leadId = settings.arguments as String;
        }
        return MaterialPageRoute(
          builder: (_) => LeadDetailsPage(
            detail: detailModel,
            leadId: leadId,
          ),
        );

      case orders:
        return MaterialPageRoute(
          builder: (_) => const OrdersPage(),
        );

      case whatsapp:
        return MaterialPageRoute(
          builder: (_) => const WhatsAppConversationsPage(),
        );

      case whatsappChat:
        final conversation = settings.arguments is WhatsAppConversation
            ? settings.arguments as WhatsAppConversation
            : WhatsAppConversation.sampleConversations().first;
        return MaterialPageRoute(
          builder: (_) => WhatsAppChatPage(conversation: conversation),
        );

      case profile:
        return MaterialPageRoute(
          builder: (_) => const UserProfilePage(),
        );

      case privacyPolicy:
        final initialTab = settings.arguments is int ? settings.arguments as int : 0;
        return MaterialPageRoute(
          builder: (_) => PrivacyPolicyPage(initialTabIndex: initialTab),
        );

      case calls:
        final initialTab = settings.arguments is int ? settings.arguments as int : 0;
        return MaterialPageRoute(
          builder: (_) => CallsPage(initialTabIndex: initialTab),
        );

      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
        );
    }
  }
}
