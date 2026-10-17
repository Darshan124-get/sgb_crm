import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/reports/domain/models/telecaller_daily_report_model.dart';
import 'package:sgbconnect/features/reports/presentation/widgets/daily_telecaller_report_sheet.dart';

void main() {
  group('Daily Telecaller Report Feature Tests', () {
    test('TelecallerDailyReportModel parses backend JSON accurately', () {
      final json = {
        'success': true,
        'date': '2026-10-16',
        'telecaller': {
          'id': 1,
          'name': 'Darshan A B',
          'email': 'darshan@sgbagro.com',
          'phone': '+919902018031',
          'employee_id': 'EMP-1001',
        },
        'metrics': {
          'assigned_today': 100,
          'calls_made_today': 80,
          'connected_calls': 40,
          'connected_pct': '50.0%',
          'missed_calls': 40,
          'missed_pct': '50.0%',
          'followups_scheduled': 14,
          'converted_orders': 8,
          'converted_orders_value': 24500.0,
          'converted_orders_formatted': '8 Orders (₹24,500)',
          'avg_call_duration_seconds': 222,
          'avg_call_duration_formatted': '3m 42s',
          'pending_leads_today': 20,
          'carryover_pending_yesterday': 28,
        },
        'pending_leads_today_sample': [
          {
            'lead_id': 101,
            'customer_name': 'Ramesh Patil',
            'phone_number': '9902018031',
            'district': 'Belagavi',
            'current_crop': 'Sugarcane',
            'status': 'new',
          }
        ],
        'carryover_pending_sample': [
          {
            'lead_id': 102,
            'customer_name': 'Suresh Kumar',
            'phone_number': '9876543210',
            'district': 'Mandya',
            'current_crop': 'Paddy',
            'status': 'assigned',
          }
        ]
      };

      final model = TelecallerDailyReportModel.fromJson(json);

      expect(model.assignedToday, 100);
      expect(model.callsMadeToday, 80);
      expect(model.connectedCalls, 40);
      expect(model.connectedPct, '50.0%');
      expect(model.missedCalls, 40);
      expect(model.missedPct, '50.0%');
      expect(model.followupsScheduled, 14);
      expect(model.convertedOrders, 8);
      expect(model.convertedOrdersValue, 24500.0);
      expect(model.convertedOrdersFormatted, '8 Orders (₹24,500)');
      expect(model.avgCallDurationFormatted, '3m 42s');
      expect(model.pendingLeadsToday, 20);
      expect(model.carryoverPendingYesterday, 28);
      expect(model.pendingLeadsSample.length, 2);
      expect(model.pendingLeadsSample.first.customerName, 'Ramesh Patil');
    });

    testWidgets('DailyTelecallerReportSheet renders all required metrics and Download button', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final report = TelecallerDailyReportModel.sample();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyTelecallerReportSheet(initialReport: report),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Header
      expect(find.text('Daily Telecaller Reports'), findsOneWidget);

      // Verify All Specific Metrics from Voice Request & Screenshot
      expect(find.text('Total Leads Assigned Today'), findsOneWidget);
      expect(find.text('${report.assignedToday} Leads'), findsOneWidget);

      expect(find.text('Total Called Leads Today'), findsOneWidget);
      expect(find.text('${report.callsMadeToday} Leads'), findsOneWidget);

      expect(find.text('Connected Calls'), findsOneWidget);
      expect(find.text('${report.connectedCalls} Calls (${report.connectedPct})'), findsOneWidget);

      expect(find.text('Missed / Unanswered'), findsOneWidget);
      expect(find.text('${report.missedCalls} Calls (${report.missedPct})'), findsOneWidget);

      expect(find.text('Follow-ups Scheduled'), findsOneWidget);
      expect(find.text('${report.followupsScheduled} Leads'), findsOneWidget);

      expect(find.text('Converted Orders'), findsOneWidget);
      expect(find.text(report.convertedOrdersFormatted), findsOneWidget);

      expect(find.text('Average Call Duration'), findsOneWidget);
      expect(find.text(report.avgCallDurationFormatted), findsOneWidget);

      expect(find.text('Pending Leads to Call Today'), findsOneWidget);
      expect(find.text('${report.pendingLeadsToday} Leads'), findsOneWidget);

      expect(find.text('Carryover from Yesterday'), findsOneWidget);
      expect(find.text('${report.carryoverPendingYesterday} Leads'), findsOneWidget);

      // Verify Download Button
      expect(find.text('Download PDF Report'), findsOneWidget);
      expect(find.byIcon(Icons.download_rounded), findsOneWidget);
    });
  });
}
