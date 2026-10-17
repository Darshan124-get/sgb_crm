import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_model.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/crm_order_conversion_wizard.dart';

void main() {
  const testLead = LeadModel(
    id: '123',
    name: 'Aravind koppa',
    phone: '8050126631',
    city: 'Koppa',
    state: 'Karnataka',
    time: '12:00 PM',
    status: LeadStatus.newLead,
    village: 'Koppa Village',
    district: 'Chikkamagaluru',
    pincode: '577126',
    language: 'Kannada',
  );

  Widget createTestWidget() {
    return const MaterialApp(
      home: Scaffold(
        body: CrmOrderConversionWizard(
          lead: testLead,
        ),
      ),
    );
  }

  group('CRM Order Conversion Wizard & Lead Decision Engine Tests', () {
    testWidgets('Step 1: Renders Header, phone number, and all call status pills', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Header
      expect(find.text('CRM Order Conversion Wizard'), findsOneWidget);
      expect(find.text('Lead Decision Engine'), findsOneWidget);

      // Steps indicator
      expect(find.text('1. STATUS'), findsOneWidget);
      expect(find.text('2. CUSTOMER'), findsOneWidget);
      expect(find.text('3. DECISION'), findsOneWidget);
      expect(find.text('4. PRODUCT'), findsOneWidget);

      // Step 1 fields
      expect(find.text('Section 1: Call Status'), findsOneWidget);
      expect(find.text('8050126631'), findsOneWidget);
      expect(find.text('CALL STATUS *'), findsOneWidget);

      // Call status pills
      expect(find.text('RECEIVED'), findsOneWidget);
      expect(find.text('NOT RECEIVED'), findsOneWidget);
      expect(find.text('SWITCHED OFF'), findsOneWidget);
      expect(find.text('BUSY'), findsOneWidget);
      expect(find.text('NOT REACHABLE'), findsOneWidget);
      expect(find.text('NOT INTERESTED'), findsOneWidget);
      expect(find.text('BOOKED'), findsOneWidget);
      expect(find.text('WHATSAPP'), findsOneWidget);
    });

    testWidgets('Step 1 to Step 2: Selecting Received navigates to Customer Details', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Tap Received pill
      await tester.tap(find.text('RECEIVED'));
      await tester.pumpAndSettle();

      // Step 2 should be displayed
      expect(find.text('Step 2: Customer Details'), findsOneWidget);
      expect(find.text('FARMER NAME'), findsOneWidget);
      expect(find.text('Aravind koppa'), findsOneWidget);
      expect(find.text('VILLAGE / TALUK'), findsOneWidget);
      expect(find.text('STATE'), findsOneWidget);
      expect(find.text('DISTRICT'), findsOneWidget);
      expect(find.text('PINCODE'), findsOneWidget);
      expect(find.text('LEAD LANGUAGE'), findsOneWidget);
    });

    testWidgets('Step 2 to Step 3: Navigates to Sales Status & Decision', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Select Received to get to Step 2
      await tester.tap(find.text('RECEIVED'));
      await tester.pumpAndSettle();

      // Tap Next on Step 2
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      // Step 3 should be displayed
      expect(find.text('Step 3: Sales Status & Decision'), findsOneWidget);
      expect(find.text('SALES STATUS *'), findsOneWidget);
      expect(find.text('ORDERED'), findsOneWidget);
      expect(find.text('HOT / VERY INTERESTED'), findsOneWidget);
      expect(find.text('MILD / LATER'), findsOneWidget);
      expect(find.text('COLD / NOT INTERESTED'), findsOneWidget);
      expect(find.text('OLD PURCHASED'), findsOneWidget);
      expect(find.text('DEALER'), findsOneWidget);
    });

    testWidgets('Step 3 Dynamic Subforms: Selecting Hot shows Follow-up Details', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Reach step 3
      await tester.tap(find.text('RECEIVED'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      // Tap HOT / VERY INTERESTED
      await tester.tap(find.text('HOT / VERY INTERESTED'));
      await tester.pumpAndSettle();

      // Follow-up Details subform
      expect(find.text('Follow-up Details'), findsOneWidget);
      expect(find.text('NEXT FOLLOW-UP DATE *'), findsOneWidget);
      expect(find.text('FOLLOW-UP ACTION'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('Step 3 to Step 4: Selecting Ordered navigates to Product Selection & Order', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Reach step 3
      await tester.tap(find.text('RECEIVED'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      // Tap ORDERED
      await tester.tap(find.text('ORDERED'));
      await tester.pumpAndSettle();

      // Step 4 Product selection & order
      expect(find.text('Step 4: Product Selection & Order'), findsOneWidget);
      expect(find.text('SELECT PRODUCTS (1-CLICK SELECTION)'), findsOneWidget);
      expect(find.text('Order Configuration'), findsOneWidget);
      expect(find.text('Save & Convert'), findsOneWidget);
    });

    testWidgets('Step 1 Not Connected Routing: Selecting Busy jumps to Connection Log', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Tap BUSY
      await tester.tap(find.text('BUSY'));
      await tester.pumpAndSettle();

      // Should skip straight to Connection Log
      expect(find.text('Step 3: Connection Log'), findsOneWidget);
      expect(find.text('CALL ATTEMPT'), findsOneWidget);
      expect(find.text('NEXT CALL DATE *'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });
  });
}
