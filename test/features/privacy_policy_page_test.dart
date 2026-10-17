import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/legal/presentation/pages/privacy_policy_page.dart';

void main() {
  group('PrivacyPolicyPage Widget Tests', () {
    testWidgets('Renders PrivacyPolicyPage with tabs, headers and content', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: PrivacyPolicyPage(),
        ),
      );
      await tester.pumpAndSettle();

      // Verify App Bar & Tabs
      expect(find.text('Legal & Data Safety'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsWidgets);
      expect(find.text('Terms of Use'), findsOneWidget);
      expect(find.text('Permissions'), findsOneWidget);

      // Verify DPDP Act badge & Privacy Content
      expect(find.text('DPDP Act 2023 & Google Play Compliant'), findsOneWidget);
      expect(find.text('1. Overview & Commitment'), findsOneWidget);

      // Switch to Terms of Use Tab
      await tester.tap(find.text('Terms of Use'));
      await tester.pumpAndSettle();

      expect(find.text('Terms and Conditions'), findsOneWidget);
      expect(find.text('1. Authorized Access'), findsOneWidget);

      // Switch to Permissions Tab
      await tester.tap(find.text('Permissions'));
      await tester.pumpAndSettle();

      expect(find.text('Microphone (RECORD_AUDIO)'), findsOneWidget);
      expect(find.text('Camera (CAMERA)'), findsOneWidget);
      expect(find.text('Storage & Media (READ_MEDIA_*)'), findsOneWidget);
      expect(find.text('Internet & Connection (INTERNET)'), findsOneWidget);
    });
  });
}
