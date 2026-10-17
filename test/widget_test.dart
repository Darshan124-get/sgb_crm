import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/app/app.dart';
import 'package:sgbconnect/features/auth/presentation/pages/dark_splash_screen.dart';
import 'package:sgbconnect/features/auth/presentation/pages/login_page.dart';

void main() {
  testWidgets('Dark splash screen smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const App());
    expect(find.byType(DarkSplashScreen), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('Login page smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: LoginPage(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Enter Gmail or phone number'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Remind me'), findsOneWidget);
    expect(find.text('Forgot password?'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.byType(Checkbox), findsOneWidget);
  });
}
