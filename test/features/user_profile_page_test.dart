import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/features/profile/presentation/pages/user_profile_page.dart';

void main() {
  group('UserProfilePage Widget Tests', () {
    testWidgets('Renders UserProfilePage with header, KPIs, contact info, and telephony settings', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: UserProfilePage(),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Header & Name
      expect(find.text('My Profile'), findsOneWidget);
      expect(find.text('Rahul Sharma'), findsOneWidget);
      expect(find.text('Senior Telecaller & Agro Advisory Executive'), findsOneWidget);
      expect(find.text('SGB-TC104'), findsOneWidget);
      expect(find.text('Shift Active'), findsOneWidget);

      // Verify Today's Calling Target
      expect(find.text("Today's Calling Target"), findsOneWidget);
      expect(find.textContaining('42 of 50 calls completed'), findsOneWidget);
      expect(find.text('Top Performer 🏆'), findsOneWidget);

      // Mini KPIs
      expect(find.text('Calls Made'), findsOneWidget);
      expect(find.text('Talk Time'), findsOneWidget);
      expect(find.text('Converted'), findsOneWidget);
      expect(find.text('Rating'), findsOneWidget);

      // Official Details
      expect(find.text('Official Contact & Shift Details'), findsOneWidget);
      expect(find.text('+91 98765 43210'), findsOneWidget);
      expect(find.text('rahul.sharma@sgbagro.com'), findsOneWidget);
      expect(find.text('Hindi'), findsOneWidget);
      expect(find.text('Rajasthani'), findsOneWidget);

      // Telephony Settings
      expect(find.text('Telephony & Acefone Integration'), findsOneWidget);
      expect(find.text('Acefone Cloud Extension'), findsOneWidget);
      expect(find.text('Auto Call Recording'), findsOneWidget);
      expect(find.text('WhatsApp Handoff Alerts'), findsOneWidget);

      // Security & Shift
      expect(find.text('Security & Attendance'), findsOneWidget);
      expect(find.text('Clock Out & End Shift'), findsOneWidget);
      expect(find.text('Biometric App Lock'), findsOneWidget);
      expect(find.text('Log Out from SGB Connect'), findsOneWidget);
    });

    testWidgets('Tapping Edit Profile button opens edit sheet and updates details', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: UserProfilePage(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Edit Profile icon
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();

      // Verify Edit Sheet is visible
      expect(find.text('Edit Telecaller Profile'), findsOneWidget);
      expect(find.text('Full Name'), findsOneWidget);

      // Update name
      final nameField = find.widgetWithText(TextField, 'Rahul Sharma');
      await tester.enterText(nameField, 'Rahul S. Sharma');
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      // Verify updated name
      expect(find.text('Rahul S. Sharma'), findsOneWidget);
      expect(find.text('Profile details updated successfully!'), findsOneWidget);
    });

    testWidgets('End shift confirmation dialog works properly', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: UserProfilePage(),
        ),
      );
      await tester.pumpAndSettle();

      // Scroll to End Shift button if needed
      await tester.scrollUntilVisible(find.text('End Shift'), 100);
      await tester.tap(find.text('End Shift'));
      await tester.pumpAndSettle();

      // Dialog appears
      expect(find.text('End Daily Shift?'), findsOneWidget);
      expect(find.text('Clock Out'), findsOneWidget);

      // Tap Clock Out
      await tester.tap(find.text('Clock Out'));
      await tester.pumpAndSettle();

      expect(find.text('Shift Ended'), findsOneWidget);
    });

    testWidgets('Logout confirmation dialog opens when clicking Log Out', (WidgetTester tester) async {
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

      // Scroll to Log Out button
      await tester.scrollUntilVisible(find.text('Log Out from SGB Connect'), 100);
      await tester.tap(find.text('Log Out from SGB Connect'));
      await tester.pumpAndSettle();

      // Dialog opens
      expect(find.text('Confirm Logout'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });
  });
}
