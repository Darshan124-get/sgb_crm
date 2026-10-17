import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_detail_model.dart';
import 'package:sgbconnect/features/leads/presentation/pages/lead_details_page.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_audio_player_card.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_detail_skeleton.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_purchase_tab.dart';

void main() {
  group('LeadDetailsPage Widget Tests', () {
    testWidgets('LeadDetailsPage renders skeleton loader when detail is null', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LeadDetailsPage(detail: null, leadId: 'temp_id'),
        ),
      );
      expect(find.byType(LeadDetailSkeleton), findsOneWidget);
    });

    testWidgets('Renders LeadDetailsPage with complete header, quick actions, and overview tab', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadDetailsPage(detail: LeadDetailModel.sampleRameshKumar()),
        ),
      );
      await tester.pumpAndSettle();

      // 1. App Bar
      expect(find.text('Lead Details'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back_ios_new_rounded), findsOneWidget);

      // 2. Customer Profile
      expect(find.text('RK'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('New'), findsWidgets);
      expect(find.text('+91 98765 43210'), findsOneWidget);
      expect(find.text('Jaipur, Rajasthan'), findsWidgets);
      expect(find.text('Facebook Ad - Campaign 1'), findsWidgets);
      expect(find.text('Organic Fertilizers'), findsOneWidget);

      // 3. Quick Action Buttons
      expect(find.text('Call'), findsOneWidget);
      expect(find.text('WhatsApp'), findsOneWidget);
      expect(find.text('Convert'), findsOneWidget);
      expect(find.text('Follow-up'), findsOneWidget);
      expect(find.text('More'), findsOneWidget);

      // 4. Tab Bar
      expect(find.text('Overview'), findsOneWidget);
      expect(find.text('Timeline'), findsOneWidget);
      expect(find.text('Call Logs'), findsOneWidget);
      expect(find.text('Purchase'), findsOneWidget);
      expect(find.text('Details'), findsOneWidget);

      // 5. Overview Tab Content - Lead Information
      expect(find.text('Lead Information'), findsOneWidget);
      expect(find.text('Monsoon Offer 2024'), findsOneWidget);
      expect(find.text('Language'), findsOneWidget);
      expect(find.text('Hindi'), findsOneWidget);
      expect(find.text('Assigned To'), findsOneWidget);
      expect(find.text('Rahul Sharma'), findsOneWidget);
      expect(find.text('Organic Fertilizer'), findsOneWidget);
      expect(find.text('Wheat'), findsOneWidget);
      expect(find.text('Price Inquiry'), findsOneWidget);
      expect(find.text('Add Tag'), findsOneWidget);

      // 6. Overview Tab Content - Call History
      expect(find.text('Call History'), findsOneWidget);
      expect(find.text('Outgoing Call'), findsWidgets);
      expect(find.text('Missed Call'), findsOneWidget);
      expect(find.text('No Answer'), findsOneWidget);
      expect(find.text('Connected • 04:12'), findsOneWidget);

      // 7. Audio Waveform Player
      expect(find.byType(LeadAudioPlayerCard), findsOneWidget);
      expect(find.text('04:12'), findsWidgets);

      // 8. Sticky Click to Call Button
      expect(find.text('Click to Call'), findsOneWidget);
    });

    testWidgets('Tapping Timeline tab displays Lead Timeline and Purchase History', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadDetailsPage(detail: LeadDetailModel.sampleRameshKumar()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on 'Timeline' tab
      await tester.tap(find.text('Timeline'));
      await tester.pumpAndSettle();

      // Verify Timeline section
      expect(find.text('Lead Timeline'), findsOneWidget);
      expect(find.text('All Activities'), findsOneWidget);
      expect(find.text('Lead Created'), findsOneWidget);
      expect(find.text('Lead created from Facebook Ad - Campaign 1'), findsOneWidget);
      expect(find.text('Assigned to Rahul Sharma'), findsOneWidget);
      expect(find.text('Call - Connected'), findsOneWidget);
      expect(find.text('Note Added'), findsOneWidget);
      expect(find.text('Follow-up Scheduled'), findsOneWidget);
      expect(find.text('WhatsApp Message Sent'), findsOneWidget);
      expect(find.text('Status Updated'), findsOneWidget);
      expect(find.text('Play'), findsOneWidget);

      // Verify Purchase History section
      expect(find.text('Purchase History'), findsOneWidget);
      expect(find.text('Total Orders'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('Total Value'), findsOneWidget);
      expect(find.text('₹24,500'), findsOneWidget);
      expect(find.text('Total Units'), findsOneWidget);
      expect(find.text('16'), findsOneWidget);
      expect(find.text('Last Order'), findsOneWidget);
      expect(find.text('15 Aug 2024'), findsWidgets);

      // Verify Orders
      expect(find.text('#ORD-1024'), findsOneWidget);
      expect(find.text('Organic Fertilizer 5 kg'), findsOneWidget);
      expect(find.text('₹12,000'), findsOneWidget);

      expect(find.text('#ORD-0987'), findsOneWidget);
      expect(find.text('Plant Growth Booster'), findsOneWidget);
      expect(find.text('₹4,500'), findsOneWidget);

      expect(find.text('#ORD-0765'), findsOneWidget);
      expect(find.text('Neem Oil 1 Ltr'), findsOneWidget);
      expect(find.text('₹8,000'), findsOneWidget);
    });

    testWidgets('Tapping Call to Call triggers Acefone calling action', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadDetailsPage(detail: LeadDetailModel.sampleRameshKumar()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Click to Call button
      await tester.tap(find.text('Click to Call'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Dialing Ramesh Kumar'), findsOneWidget);
    });

    testWidgets('Audio player play/pause toggle starts and pauses playback', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadDetailsPage(detail: LeadDetailModel.sampleRameshKumar()),
        ),
      );
      await tester.pumpAndSettle();

      // Initial state is 00:00
      expect(find.text('00:00'), findsOneWidget);

      // Tap play arrow icon
      await tester.tap(find.byIcon(Icons.play_arrow_rounded));
      await tester.pump(const Duration(milliseconds: 600));

      // Icon changes to pause
      expect(find.byIcon(Icons.pause_rounded), findsOneWidget);

      // Tap pause icon to stop playback
      await tester.tap(find.byIcon(Icons.pause_rounded));
      await tester.pump(const Duration(milliseconds: 100));

      // Returns to play arrow
      expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    });

    testWidgets('Can switch across Call Logs, Purchase, and Details tabs', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadDetailsPage(detail: LeadDetailModel.sampleRameshKumar()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Call Logs
      await tester.ensureVisible(find.text('Call Logs'));
      await tester.tap(find.text('Call Logs'));
      await tester.pumpAndSettle();
      expect(find.text('All Call Recordings & Logs'), findsOneWidget);

      // Tap Purchase
      await tester.ensureVisible(find.text('Purchase'));
      await tester.tap(find.text('Purchase'));
      await tester.pumpAndSettle();
      expect(find.text('Order Invoices & Products'), findsOneWidget);
      expect(find.textContaining('#ORD-1024'), findsOneWidget);
      expect(find.text('Delivered'), findsWidgets);

      // Tap Details
      await tester.ensureVisible(find.text('Details'));
      await tester.tap(find.text('Details'));
      await tester.pumpAndSettle();
      expect(find.text('Agricultural & Farm Profile'), findsOneWidget);
      expect(find.text('12 Acres'), findsOneWidget);
      expect(find.text('Wheat, Mustard & Groundnut'), findsOneWidget);
      expect(find.text('Verified Customer'), findsOneWidget);
    });

    testWidgets('LeadPurchaseTab displays empty state placeholder when no purchases exist', (WidgetTester tester) async {
      final emptyLeadDetail = LeadDetailModel.fromBackend({
        'lead_id': 101,
        'customer_name': 'Test Farmer',
        'phone_number': '9876543210',
        'status': 'new',
        'order_history': [],
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LeadPurchaseTab(detail: emptyLeadDetail),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No Purchase Orders Yet'), findsOneWidget);
      expect(find.text('Total Orders'), findsOneWidget);
      expect(find.text('0'), findsWidgets);
      expect(find.text('₹0'), findsOneWidget);
      expect(find.text('None'), findsOneWidget);
    });

    test('LeadDetailModel.fromBackend parses order_history with total_units and items_summary correctly', () {
      final model = LeadDetailModel.fromBackend({
        'lead_id': 44879,
        'customer_name': 'Ramesh Patel',
        'phone_number': '9999900001',
        'status': 'converted',
        'order_history': [
          {
            'order_id': 3645,
            'customer_name': 'Ramesh Patel',
            'phone': '9999900001',
            'order_status': 'draft',
            'total_amount': '600.00',
            'created_at': '2026-10-16T09:23:53.000Z',
            'items_summary': 'SGB -Blade Protection (x1)',
            'total_units': '2',
          }
        ]
      });

      expect(model.purchases.length, 1);
      expect(model.purchases.first.orderId, '#3645');
      expect(model.purchases.first.productName, 'SGB -Blade Protection (x1)');
      expect(model.purchases.first.units, 2);
      expect(model.purchases.first.price, 600);
      expect(model.purchases.first.status, 'Draft');
      expect(model.purchaseSummary.totalOrders, 1);
      expect(model.purchaseSummary.totalUnits, 2);
      expect(model.purchaseSummary.totalValue, 600);
    });
  });
}
