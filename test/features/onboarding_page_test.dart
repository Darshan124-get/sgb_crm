import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/auth/presentation/pages/onboarding_page.dart';

void main() {
  testWidgets('OnboardingPage renders initial screen correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: OnboardingPage(),
      ),
    );

    // Verify Brand title & Skip button
    expect(find.text('SGB '), findsOneWidget);
    expect(find.text('Connect'), findsOneWidget);
    expect(find.text('Skip'), findsOneWidget);

    // Verify first slide contents
    expect(find.text('SMART TELECALLING'), findsOneWidget);
    expect(find.text('One-Tap Calling &\nInstant Mobile Dialing'), findsOneWidget);
    expect(find.text('1-Tap Click-to-Call Dialer'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);
  });

  testWidgets('OnboardingPage navigates through all 3 slides', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: OnboardingPage(),
      ),
    );

    // Slide 1 -> Slide 2
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('OMNICHANNEL CRM'), findsOneWidget);
    expect(find.text('Lead Management &\nInstant WhatsApp Chats'), findsOneWidget);
    expect(find.text('Direct WhatsApp Messaging'), findsOneWidget);

    // Slide 2 -> Slide 3
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('GROWTH & CONVERSIONS'), findsOneWidget);
    expect(find.text('Convert Leads into\nConfirmed Sales Orders'), findsOneWidget);
    expect(find.text('Fast Mobile Order Booking'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
  });

  testWidgets('OnboardingPage triggers onFinished on Skip and Get Started', (WidgetTester tester) async {
    bool finished = false;

    await tester.pumpWidget(
      MaterialApp(
        home: OnboardingPage(
          onFinished: () {
            finished = true;
          },
        ),
      ),
    );

    // Tap Skip
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    expect(finished, isTrue);
  });
}
