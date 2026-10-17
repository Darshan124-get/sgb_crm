import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/calls/domain/models/call_record_model.dart';
import 'package:sgbconnect/features/calls/presentation/pages/calls_page.dart';
import 'package:sgbconnect/features/calls/presentation/widgets/call_details_bottom_sheet.dart';
import 'package:sgbconnect/features/calls/presentation/widgets/dialer_keypad_view.dart';

void main() {
  group('Calls Feature Widget & Unit Tests', () {
    test('CallRecordModel parses JSON and computes helper attributes', () {
      final json = {
        'id': 10,
        'call_id': 'call_TEST_123',
        'acefone_call_id': 'ACE_123',
        'customer_phone': '+919902018031',
        'lead_id': 'L-999',
        'lead_name': 'Ramesh Patil',
        'crm_user_id': 1,
        'crm_user_name': 'Darshan A B',
        'agent_extension': '1001',
        'direction': 'outbound',
        'started_at': '2026-10-16T10:30:00Z',
        'duration_seconds': 150,
        'talk_time_seconds': 140,
        'technical_status': 'CONNECTED',
        'hangup_reason': 'Normal Clearing',
        'did_number': '+918047192200',
        'r2_object_key': 'telephony/recordings/2026/10/call_test.mp3',
      };

      final model = CallRecordModel.fromJson(json);

      expect(model.id, 10);
      expect(model.customerPhone, '+919902018031');
      expect(model.isOutbound, true);
      expect(model.isAnswered, true);
      expect(model.isMissed, false);
      expect(model.statusLabel, 'Connected');
      expect(model.formattedDuration, '02:30');
      expect(model.formattedTalkTime, '02:20');
      expect(model.hasAudio, true);
      expect(model.audioStreamUrl, contains('/media/telephony/recordings/2026/10/call_test.mp3'));
    });

    testWidgets('CallsPage renders tabs, recents list, and bottom nav', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: CallsPage(),
        ),
      );
      await tester.pumpAndSettle();

      // Verify app bar title
      expect(find.text('Calls & Dialer'), findsOneWidget);

      // Verify tabs
      expect(find.text('Recent Calls'), findsOneWidget);
      expect(find.text('Dialer Keypad'), findsOneWidget);

      // Verify search input
      expect(find.byType(TextField), findsOneWidget);

      // Tap Dialer Keypad tab
      await tester.tap(find.text('Dialer Keypad'));
      await tester.pumpAndSettle();

      // Verify Keypad displayed
      expect(find.text('Enter phone number...'), findsOneWidget);
      expect(find.text('Acefone Cloud Telephony'), findsOneWidget);
    });

    testWidgets('DialerKeypadView enters digits and allows backspace', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DialerKeypadView(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap digit 9
      await tester.tap(find.text('9'));
      await tester.pumpAndSettle();

      // Tap digit 8
      await tester.tap(find.text('8'));
      await tester.pumpAndSettle();

      // Tap digit 7
      await tester.tap(find.text('7'));
      await tester.pumpAndSettle();

      // Number should display 987
      expect(find.text('987'), findsOneWidget);

      // Tap backspace icon
      await tester.tap(find.byIcon(Icons.backspace_outlined));
      await tester.pumpAndSettle();

      expect(find.text('98'), findsOneWidget);
    });

    testWidgets('CallDetailsBottomSheet renders call details and action buttons', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final sample = CallRecordModel.sampleCalls().first;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CallDetailsBottomSheet(call: sample),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify customer phone and lead name
      expect(find.text(sample.customerPhone), findsOneWidget);
      expect(find.text(sample.leadName!), findsOneWidget);

      // Verify metadata fields
      expect(find.text('Telecaller'), findsOneWidget);
      expect(find.text('Talk Time / Total Duration'), findsOneWidget);
      expect(find.text('DID (Caller ID)'), findsOneWidget);
      expect(find.text('Hangup Cause'), findsOneWidget);

      // Verify buttons
      expect(find.text('Call Back'), findsOneWidget);
      expect(find.text('Copy'), findsOneWidget);
    });
  });
}
