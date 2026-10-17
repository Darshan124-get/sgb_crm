import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_model.dart';
import 'package:sgbconnect/features/leads/presentation/pages/leads_page.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_card.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_detail_bottom_sheet.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_skeleton_loader.dart';

void main() {
  group('LeadsPage Widget Tests', () {
    testWidgets('Renders LeadsPage with header, filter pills, search input, and lead list', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Verify Top App Bar
      expect(find.text('Leads'), findsWidgets); // App bar title & bottom nav
      expect(find.byIcon(Icons.arrow_back_ios_new_rounded), findsOneWidget);
      expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);

      // 2. Verify Filter Chips
      expect(find.text('Today (32)'), findsOneWidget);
      expect(find.text('New (48)'), findsOneWidget);
      expect(find.text('All (125)'), findsOneWidget);
      expect(find.text('Follow-up (36)'), findsOneWidget);
      expect(find.text('More'), findsNWidgets(2)); // Chips and Bottom Nav

      // 3. Verify Search Bar
      expect(find.text('Search by name or number...'), findsOneWidget);
      expect(find.byIcon(Icons.filter_alt_rounded), findsOneWidget);

      // 4. Verify Leads rendered matching screenshot
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('+91 98765 43210'), findsOneWidget);
      expect(find.text('Jaipur, Rajasthan'), findsOneWidget);
      expect(find.text('10:30 AM'), findsOneWidget);
      expect(find.text('New'), findsWidgets);

      expect(find.text('Priya Singh'), findsOneWidget);
      expect(find.text('+91 87654 32109'), findsOneWidget);
      expect(find.text('Ajmer, Rajasthan'), findsOneWidget);
      expect(find.text('10:15 AM'), findsOneWidget);
      expect(find.text('Follow-up'), findsWidgets);

      expect(find.text('Amit Patel'), findsOneWidget);
      expect(find.text('+91 78965 43210'), findsOneWidget);
      expect(find.text('Kota, Rajasthan'), findsOneWidget);
      expect(find.text('09:45 AM'), findsOneWidget);
      expect(find.text('Interested'), findsOneWidget);

      expect(find.text('Sunita Devi'), findsOneWidget);
      expect(find.text('+91 98712 34567'), findsOneWidget);
      expect(find.text('Bikaner, Rajasthan'), findsOneWidget);

      expect(find.text('Vikram Reddy'), findsOneWidget);
      expect(find.text('+91 91234 56789'), findsOneWidget);
      expect(find.text('Udaipur, Rajasthan'), findsOneWidget);
      expect(find.text('Call Connected'), findsOneWidget);
    });

    testWidgets('Filter chip selection filters the lead list dynamically', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on 'New (48)' chip
      await tester.tap(find.text('New (48)'));
      await tester.pumpAndSettle();

      // Ramesh Kumar is New, so should appear
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      // Priya Singh is Follow-up, so should not appear under New
      expect(find.text('Priya Singh'), findsNothing);

      // Scroll horizontally to ensure 'Follow-up (36)' is fully in view, then tap it
      await tester.ensureVisible(find.text('Follow-up (36)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Follow-up (36)'));
      await tester.pumpAndSettle();

      // Priya Singh and Sunita Devi should appear
      expect(find.text('Priya Singh'), findsOneWidget);
      expect(find.text('Sunita Devi'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsNothing);
    });

    testWidgets('Search input filters leads by customer name and phone', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to 'All (125)' first
      await tester.tap(find.text('All (125)'));
      await tester.pumpAndSettle();

      // Enter search query 'Vikram'
      await tester.enterText(find.byType(TextField), 'Vikram');
      await tester.pumpAndSettle();

      expect(find.text('Vikram Reddy'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsNothing);

      // Search by phone digits
      await tester.enterText(find.byType(TextField), '78965');
      await tester.pumpAndSettle();

      expect(find.text('Amit Patel'), findsOneWidget);
      expect(find.text('Vikram Reddy'), findsNothing);
    });

    testWidgets('Tapping a LeadCard opens LeadDetailBottomSheet with Acefone calling', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Ramesh Kumar card
      await tester.tap(find.text('Ramesh Kumar'));
      await tester.pumpAndSettle();

      // Verify Bottom Sheet
      expect(find.byType(LeadDetailBottomSheet), findsOneWidget);
      expect(find.text('Call Lead'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(LeadDetailBottomSheet),
          matching: find.text('WhatsApp'),
        ),
        findsOneWidget,
      );
      expect(find.text('Schedule Next Follow-up'), findsOneWidget);

      // Tap Call Lead
      await tester.tap(find.text('Call Lead'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Dialing Ramesh Kumar'), findsOneWidget);
    });

    testWidgets('Smooth skeleton shimmer displays during loading state', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: true,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );

      // Single frame pump to observe skeleton state before timer completes
      await tester.pump();

      // Skeleton loader should be visible
      expect(find.byType(LeadSkeletonList), findsOneWidget);
      expect(find.byType(LeadSkeletonCard), findsWidgets);

      // Fast-forward past the 1-second loading simulated delay
      await tester.pump(const Duration(milliseconds: 1100));
      await tester.pump();

      // Leads list should now be visible and skeleton gone
      expect(find.byType(LeadCard), findsWidgets);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
    });

    testWidgets('LeadsPage bottom bar has WhatsApp and tapping More opens Reports inside', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify WhatsApp item in bottom bar
      expect(find.text('WhatsApp'), findsOneWidget);

      // Tap bottom nav 'More'
      await tester.tap(find.text('More').last);
      await tester.pumpAndSettle();

      // Verify Reports is moved inside More
      expect(find.text('More Options'), findsOneWidget);
      expect(find.text('Reports & Analytics'), findsOneWidget);
    });

    testWidgets('LeadsPage tapping WhatsApp tab navigates to WhatsApp CRM screen', (WidgetTester tester) async {
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

      // Tap bottom nav 'WhatsApp'
      await tester.tap(find.text('WhatsApp'));
      await tester.pumpAndSettle();

      // Verify WhatsApp CRM screen renders
      expect(find.text('WhatsApp CRM'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
    });

    testWidgets('Tapping More chip opens bottom sheet with Hot Leads, Open Leads, and Lost Leads', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on 'More' chip in the filter chips row (the first 'More')
      final moreChip = find.text('More').first;
      await tester.ensureVisible(moreChip);
      await tester.pumpAndSettle();
      await tester.tap(moreChip);
      await tester.pumpAndSettle();

      // Verify bottom sheet shows Pipeline Filters and all requested categories
      expect(find.text('Pipeline Filters'), findsOneWidget);
      expect(find.text('Hot Leads'), findsOneWidget);
      expect(find.text('Open Leads'), findsOneWidget);
      expect(find.text('Lost Leads'), findsOneWidget);
      expect(find.text('Converted Leads'), findsOneWidget);

      // 1. Select 'Hot Leads'
      await tester.tap(find.text('Hot Leads'));
      await tester.pumpAndSettle();

      // Verify hot leads (Anjali Gupta, Amit Patel) are displayed
      expect(find.text('Anjali Gupta'), findsOneWidget);
      expect(find.text('Amit Patel'), findsOneWidget);
      // Non-hot leads should be filtered out
      expect(find.text('Mahesh Verma'), findsNothing);

      // Verify More chip now displays Hot Leads count
      expect(find.textContaining('Hot Leads'), findsWidgets);

      // 2. Tap on the Hot Leads chip to reopen More dialog and select 'Lost Leads'
      final hotChip = find.textContaining('Hot Leads').first;
      await tester.ensureVisible(hotChip);
      await tester.pumpAndSettle();
      await tester.tap(hotChip);
      await tester.pumpAndSettle();

      expect(find.text('Pipeline Filters'), findsOneWidget);
      await tester.tap(find.text('Lost Leads'));
      await tester.pumpAndSettle();

      // Verify lost leads (Mahesh Verma) are displayed
      expect(find.text('Mahesh Verma'), findsOneWidget);
      expect(find.text('Anjali Gupta'), findsNothing);
      expect(find.text('Ramesh Kumar'), findsNothing);

      // 3. Tap to reopen and select 'Open Leads'
      final lostChip = find.textContaining('Lost Leads').first;
      await tester.ensureVisible(lostChip);
      await tester.pumpAndSettle();
      await tester.tap(lostChip);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Leads'));
      await tester.pumpAndSettle();

      // Verify active leads are displayed, but lost lead is excluded
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Priya Singh'), findsOneWidget);
      expect(find.text('Mahesh Verma'), findsNothing);
    });

    testWidgets('Tapping Filter Funnel button opens modal with DATE, SCORE, STATUS, PRIORITY, and CAMPAIGN filters', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: LeadModel.sampleLeads(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on Filter Funnel button next to search
      await tester.tap(find.byIcon(Icons.filter_alt_rounded).first);
      await tester.pumpAndSettle();

      // Verify all requested filter sections are present
      expect(find.text('Filter Leads'), findsOneWidget);
      expect(find.text('DATE'), findsOneWidget);
      expect(find.text('SCORE'), findsOneWidget);
      expect(find.text('STATUS'), findsOneWidget);
      expect(find.text('PRIORITY'), findsOneWidget);
      expect(find.text('CAMPAIGN'), findsOneWidget);

      // Select 'High' priority
      await tester.tap(find.text('High'));
      await tester.pumpAndSettle();

      // Tap Apply Filters
      await tester.tap(find.textContaining('Apply Filters'));
      await tester.pumpAndSettle();

      // Verify High priority leads (Ramesh Kumar, Amit Patel, Anjali Gupta) appear
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Amit Patel'), findsOneWidget);
      // Low priority leads (Vikram Reddy, Mahesh Verma) should be filtered out
      expect(find.text('Vikram Reddy'), findsNothing);
      expect(find.text('Mahesh Verma'), findsNothing);

      // Verify active filter badge displays '1'
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('Leads assigned today appear in Today tab and New tab with status New', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final todayLeadJson = {
        'lead_id': 5037,
        'customer_name': 'darshan test',
        'phone_number': '6364594854',
        'city': 'Koppa',
        'state': 'Karnataka',
        'status': 'assigned',
        'assigned_to': 107,
        'created_at': '2026-09-25T10:21:08.000Z',
        'assigned_at': DateTime.now().toUtc().toIso8601String(),
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      };

      final lead = LeadModel.fromJson(todayLeadJson);
      expect(lead.isToday, isTrue);
      expect(lead.status, LeadStatus.newLead);

      await tester.pumpWidget(
        MaterialApp(
          home: LeadsPage(
            startLoading: false,
            initialLeads: [lead],
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify lead appears in Today tab (default active)
      expect(find.text('darshan test'), findsOneWidget);
      expect(find.text('New'), findsOneWidget);

      // Tap on New tab
      await tester.tap(find.textContaining('New ('));
      await tester.pumpAndSettle();

      // Verify lead appears in New tab
      expect(find.text('darshan test'), findsOneWidget);
      expect(find.text('New'), findsOneWidget);
    });
  });
}
