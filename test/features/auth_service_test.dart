import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sgbconnect/core/network/api_config.dart';
import 'package:sgbconnect/core/storage/session_storage.dart';
import 'package:sgbconnect/features/auth/domain/models/user_model.dart';
import 'package:sgbconnect/features/auth/presentation/pages/login_page.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await ApiConfig.init();
    await SessionStorage.init();
  });

  group('Auth Model & Storage Tests', () {
    test('UserModel deserializes accurately from backend auth payload', () {
      final backendPayload = {
        'id': 56,
        'user_id': 56,
        'name': 'Test Admin',
        'email': 'testadmin@sgbagro.com',
        'phone': '9876543210',
        'employee_id': 'EMP056',
        'role': 'admin',
        'language': 'EN',
        'permissions': ['sales_dashboard', 'sales_orders'],
        'department_id': 2,
        'is_manager': true,
      };

      final user = UserModel.fromJson(backendPayload);

      expect(user.id, equals(56));
      expect(user.userId, equals(56));
      expect(user.name, equals('Test Admin'));
      expect(user.email, equals('testadmin@sgbagro.com'));
      expect(user.role, equals('admin'));
      expect(user.permissions, contains('sales_dashboard'));
      expect(user.isManager, isTrue);
      expect(user.isAdmin, isTrue);

      final jsonMap = user.toJson();
      expect(jsonMap['user_id'], equals(56));
      expect(jsonMap['name'], equals('Test Admin'));
    });

    test('SessionStorage persists and clears user session and remember-me', () async {
      final user = UserModel(
        id: 60,
        userId: 60,
        name: 'Kavya Telecaller',
        email: 'kavya@sgbagroindustries.com',
        role: 'telecaller_executive',
      );

      await SessionStorage.saveSession(
        token: 'mock_jwt_token_123',
        user: user,
      );

      expect(SessionStorage.isLoggedIn, isTrue);
      expect(SessionStorage.token, equals('mock_jwt_token_123'));
      expect(SessionStorage.currentUser?.name, equals('Kavya Telecaller'));

      await SessionStorage.saveRememberMe(
        remember: true,
        identifier: 'kavya@sgbagroindustries.com',
      );

      final rememberData = await SessionStorage.getRememberMe();
      expect(rememberData['remember'], isTrue);
      expect(rememberData['identifier'], equals('kavya@sgbagroindustries.com'));

      await SessionStorage.clearSession();
      expect(SessionStorage.isLoggedIn, isFalse);
      expect(SessionStorage.token, isNull);
    });

    test('ApiConfig allows switching between emulator, LAN, and custom server', () async {
      await ApiConfig.setBaseUrl('http://192.168.1.120:5000/api');
      expect(ApiConfig.baseUrl, equals('http://192.168.1.120:5000/api'));

      await ApiConfig.setBaseUrl('https://mycrm.com');
      expect(ApiConfig.baseUrl, equals('https://mycrm.com/api'));

      await ApiConfig.resetToDefault();
      expect(ApiConfig.baseUrl, equals(ApiConfig.defaultBaseUrl));
    });
  });

  group('LoginPage Widget & Interaction Tests', () {
    testWidgets('LoginPage shows validation error when fields are empty', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: LoginPage(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Sign In button without typing anything
      await tester.tap(find.text('Sign In'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter your email or phone number'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
    });

    testWidgets('LoginPage toggles password visibility', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: LoginPage(),
        ),
      );
      await tester.pumpAndSettle();

      final toggleIcon = find.byIcon(Icons.visibility_off_outlined);
      expect(toggleIcon, findsOneWidget);

      await tester.tap(toggleIcon);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    });

    testWidgets('LoginPage renders production login view without debug server settings button', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: LoginPage(),
        ),
      );
      await tester.pumpAndSettle();

      // Ensure server settings button and dialog are not present in production
      expect(find.byTooltip('Server Settings'), findsNothing);
      expect(find.text('Backend API Server'), findsNothing);
    });
  });
}
