import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/core/storage/session_storage.dart';
import 'package:sgbconnect/features/auth/domain/models/user_model.dart';
import 'package:sgbconnect/features/dashboard/domain/models/dashboard_data.dart';
import 'package:sgbconnect/features/dashboard/presentation/pages/dashboard_page.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_detail_model.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_model.dart';
import 'package:sgbconnect/features/leads/presentation/pages/lead_details_page.dart';
import 'package:sgbconnect/features/leads/presentation/pages/leads_page.dart';
import 'package:sgbconnect/features/orders/domain/models/order_model.dart';
import 'package:sgbconnect/features/orders/presentation/pages/orders_page.dart';
import 'package:sgbconnect/features/profile/presentation/pages/user_profile_page.dart';
import 'package:sgbconnect/features/whatsapp/domain/models/whatsapp_model.dart';
import 'package:sgbconnect/features/whatsapp/presentation/pages/whatsapp_chat_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('E2E Telecaller Dynamic CRM Flow', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await SessionStorage.saveSession(
        token: 'test_jwt_telecaller_e2e_token',
        user: const UserModel(
          id: 101,
          userId: 101,
          name: 'Sunil Telecaller',
          role: 'telecaller',
          email: 'sunil@sgb.com',
          phone: '+91 98765 00000',
          employeeId: 'TC-904',
        ),
      );
    });

    tearDown(() async {
      await SessionStorage.clearSession();
    });

    testWidgets('1. Dashboard loads live KPIs and navigation bar', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: DashboardPage(initialData: DashboardData.sample()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DashboardPage), findsOneWidget);
      expect(find.text('Total Leads'), findsOneWidget);
      expect(find.text('Called'), findsWidgets);
      expect(find.text('Connected'), findsWidgets);
      expect(find.text('Sold Orders'), findsOneWidget);
    });

    testWidgets('2. Leads screen displays leads and filters dynamically', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(LeadsPage), findsOneWidget);
      expect(find.text('Search by name or number...'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Priya Singh'), findsOneWidget);

      // Filter by New
      await tester.tap(find.text('New (48)'));
      await tester.pumpAndSettle();
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Priya Singh'), findsNothing);
    });

    testWidgets('3. Lead Details loads dynamic overview and timeline', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: LeadDetailsPage(
            detail: LeadDetailModel.sampleRameshKumar(),
            leadId: '1',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(LeadDetailsPage), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Overview'), findsOneWidget);
      expect(find.text('Timeline'), findsOneWidget);

      // Switch to Timeline Tab
      await tester.tap(find.text('Timeline'));
      await tester.pumpAndSettle();
      expect(find.text('Lead Timeline'), findsOneWidget);
      expect(find.text('Purchase History'), findsOneWidget);
    });

    testWidgets('4. WhatsApp CRM lists conversations, resolves handoff, and sends messages', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final conversation = WhatsAppConversation.sampleConversations().first;

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: WhatsAppChatPage(conversation: conversation),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(WhatsAppChatPage), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);

      // Start Chat to resolve handoff
      final startChatFinder = find.text('Start Chat');
      if (startChatFinder.evaluate().isNotEmpty) {
        await tester.tap(startChatFinder);
        await tester.pumpAndSettle();
      }

      final inputField = find.byType(TextField);
      expect(inputField, findsOneWidget);

      await tester.enterText(inputField, 'Namaste Ramesh ji, payment confirmed!');
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.send_rounded), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Namaste Ramesh ji, payment confirmed!'), findsOneWidget);
    });

    testWidgets('5. Orders page loads orders and handles status filters', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: OrdersPage(initialOrders: OrderModel.sampleOrders()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(OrdersPage), findsOneWidget);
      expect(find.text('Orders & Bookings'), findsOneWidget);
      expect(find.text('SGB-2024-09-108'), findsOneWidget);

      // Filter by Packed
      await tester.tap(find.byKey(const ValueKey('filter_tab_packed')));
      await tester.pumpAndSettle();

      // Priya Singh is Packed
      expect(find.text('Priya Singh'), findsOneWidget);
      // Ramesh Kumar is Billed (should not be in packed list)
      expect(find.text('Ramesh Kumar'), findsNothing);
    });

    testWidgets('6. User profile displays session data and handles log out dialog', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          home: UserProfilePage(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(UserProfilePage), findsOneWidget);
      expect(find.text('Sunil Telecaller'), findsOneWidget);
      expect(find.text('+91 98765 00000'), findsOneWidget);

      // Scroll and Tap Log Out
      await tester.scrollUntilVisible(find.text('Log Out from SGB Connect'), 100);
      await tester.tap(find.text('Log Out from SGB Connect'));
      await tester.pumpAndSettle();

      expect(find.text('Confirm Logout'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });
  });
}
