import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/add_lead_bottom_sheet.dart';

void main() {
  group('AddLeadBottomSheet Widget Tests', () {
    testWidgets('Renders AddLeadBottomSheet with all fields, header, and buttons', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddLeadBottomSheet(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Verify Header
      expect(find.text('Add New Lead'), findsOneWidget);
      expect(find.text('Manual entry into your SGB CRM pipeline'), findsOneWidget);

      // 2. Verify Mobile Number field (Required)
      expect(find.textContaining('Mobile Number'), findsOneWidget);
      expect(find.text('+91'), findsOneWidget);
      expect(find.text('10-digit mobile number'), findsOneWidget);

      // 3. Verify Optional fields
      expect(find.textContaining('Customer Name'), findsOneWidget);
      expect(find.textContaining('Requirement / Product'), findsOneWidget);
      expect(find.textContaining('Location / State'), findsOneWidget);
      expect(find.textContaining('(Optional)'), findsNWidgets(3));

      // 4. Verify Quick Product chips
      expect(find.text('+ Power Weeder'), findsOneWidget);
      expect(find.text('+ Brush Cutter'), findsOneWidget);
      expect(find.text('+ Trolley'), findsOneWidget);
      expect(find.text('+ Blade Protector'), findsOneWidget);

      // 5. Verify Action buttons
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Create Lead'), findsOneWidget);
    });

    testWidgets('Validates required mobile number on submit', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddLeadBottomSheet(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Create Lead without entering mobile number
      await tester.tap(find.text('Create Lead'));
      await tester.pumpAndSettle();

      // Verify validation error
      expect(find.text('Mobile number is required'), findsOneWidget);

      // Enter incomplete mobile number (e.g. 5 digits)
      final phoneField = find.widgetWithText(TextFormField, '10-digit mobile number');
      await tester.enterText(phoneField, '98765');
      await tester.tap(find.text('Create Lead'));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
    });

    testWidgets('Tapping quick product chip populates requirement field', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddLeadBottomSheet(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap "+ Power Weeder"
      await tester.tap(find.text('+ Power Weeder'));
      await tester.pumpAndSettle();

      expect(find.text('Power Weeder'), findsOneWidget);

      // Tap "+ Trolley"
      await tester.tap(find.text('+ Trolley'));
      await tester.pumpAndSettle();

      expect(find.text('Power Weeder, Trolley'), findsOneWidget);
    });
  });
}
