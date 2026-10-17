import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_model.dart';
import 'package:sgbconnect/features/leads/presentation/widgets/lead_detail_bottom_sheet.dart';

void main() {
  group('LeadDetailBottomSheet Tests', () {
    final targetLead = LeadModel(
      id: 'lead-tj-1',
      name: 'test jithin',
      phone: '8317332769',
      city: 'Rural',
      state: 'India',
      time: '11:22 PM',
      status: LeadStatus.newLead,
      isToday: false,
      notes: 'hi',
      priority: '1/5',
      score: 'Low',
      campaign: '',
      createdAt: DateTime(2026, 7, 20, 23, 22),
      firstMessage: 'hi',
      leadSource: '',
      productInterest: '',
      assignedStaff: 'darshan_acefone_test_2',
      nextFollowUp: '25 Jul 2026, 10:00 AM',
      scoreFraction: '1/5',
    );

    testWidgets('Renders all fields matching Image 1 design specification', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => LeadDetailBottomSheet(lead: targetLead),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      // Open Bottom Sheet
      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // 1. Verify Header
      expect(find.text('TJ'), findsOneWidget); // Initials circle
      expect(find.text('test jithin'), findsOneWidget); // Name
      expect(find.text('8317332769'), findsOneWidget); // Phone

      // 2. Verify 3 Metric Cards (Status shows 'New' for telecaller instead of 'Assigned')
      expect(find.text('Status'), findsOneWidget);
      expect(find.text('New'), findsNWidgets(2)); // Top badge & status card

      expect(find.text('Priority'), findsOneWidget);
      expect(find.text('1/5'), findsOneWidget);
      expect(find.byIcon(Icons.cloud_rounded), findsOneWidget);

      expect(find.text('Score'), findsOneWidget);
      expect(find.text('Low'), findsOneWidget);

      // 3. Verify Date Details Row
      expect(find.text('Created On'), findsOneWidget);
      expect(find.text('20 Jul 2026, 11:22 PM'), findsOneWidget);
      expect(find.text('Next Follow-up'), findsOneWidget);
      expect(find.text('25 Jul 2026, 10:00 AM'), findsOneWidget);

      // 4. Verify Message Box
      expect(find.text('Message'), findsOneWidget);
      expect(find.text('hi'), findsWidgets); // Message preview & message box

      // 5. Verify 3 Action Buttons (Call Lead, WhatsApp, Convert)
      expect(find.text('Call Lead'), findsOneWidget);
      expect(find.text('WhatsApp'), findsOneWidget);
      expect(find.text('Convert'), findsOneWidget);

      // 6. Verify Schedule Next Follow-up button
      expect(find.text('Schedule Next Follow-up'), findsOneWidget);

      // 7. Verify Metadata rows
      expect(find.text('Campaign'), findsOneWidget);
      expect(find.text('Lead Source'), findsOneWidget);
      expect(find.text('Product Interest'), findsOneWidget);
      expect(find.text('Assigned Staff'), findsOneWidget);
      expect(find.text('darshan_acefone_test_2'), findsOneWidget);

      // 8. Verify View Complete Lead Details & Timeline button
      expect(find.text('View Complete Lead Details & Timeline'), findsOneWidget);
    });

    testWidgets('Tapping Call Lead triggers callback and shows SnackBar', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      bool callTriggered = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => LeadDetailBottomSheet(
                      lead: targetLead,
                      onCall: () => callTriggered = true,
                    ),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Call Lead'));
      await tester.pumpAndSettle();

      expect(callTriggered, isTrue);
      expect(find.textContaining('Dialing test jithin (8317332769) via Acefone...'), findsOneWidget);
    });

    testWidgets('Tapping WhatsApp triggers callback and shows SnackBar', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      bool waTriggered = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => LeadDetailBottomSheet(
                      lead: targetLead,
                      onWhatsApp: () => waTriggered = true,
                    ),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('WhatsApp'));
      await tester.pumpAndSettle();

      expect(waTriggered, isTrue);
      expect(find.textContaining('Opening WhatsApp chat with test jithin...'), findsOneWidget);
    });

    testWidgets('Tapping Convert opens CRM Order Conversion Wizard', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => LeadDetailBottomSheet(
                      lead: targetLead,
                    ),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // Tap Convert
      await tester.tap(find.text('Convert'));
      await tester.pumpAndSettle();

      // Verify CRM Order Conversion Wizard opened
      expect(find.text('CRM Order Conversion Wizard'), findsOneWidget);
      expect(find.text('Lead Decision Engine'), findsOneWidget);
      expect(find.text('Section 1: Call Status'), findsOneWidget);
      expect(find.text('PHONE NUMBER'), findsOneWidget);
      expect(find.text('CALL STATUS *'), findsOneWidget);
    });

    testWidgets('Tapping View Complete Lead Details navigates to route', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      String? pushedRoute;
      dynamic pushedArgs;

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: (settings) {
            pushedRoute = settings.name;
            pushedArgs = settings.arguments;
            return MaterialPageRoute(
              builder: (_) => Scaffold(body: Text('Route: ${settings.name}')),
            );
          },
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => LeadDetailBottomSheet(lead: targetLead),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('View Complete Lead Details & Timeline'));
      await tester.pumpAndSettle();

      expect(pushedRoute, equals('/lead-details'));
      expect(pushedArgs, equals('lead-tj-1'));
    });
  });
}
