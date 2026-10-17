import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/features/dashboard/domain/models/dashboard_data.dart';
import 'package:sgbconnect/features/dashboard/presentation/pages/dashboard_page.dart';
import 'package:sgbconnect/features/dashboard/presentation/widgets/dashboard_skeleton_loader.dart';

void main() {
  testWidgets('DashboardPage renders skeleton loader when loading initial state', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: DashboardPage(initialData: null),
      ),
    );
    expect(find.byType(DashboardSkeletonLoader), findsOneWidget);
  });

  testWidgets('DashboardPage renders header, KPI cards, charts, and bottom navigation', (WidgetTester tester) async {
    // Provide standard phone screen size
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.5;

    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        home: DashboardPage(initialData: DashboardData.sample()),
      ),
    );

    // Let entrance animations complete
    await tester.pumpAndSettle();

    // Verify Header
    expect(find.text('Good Morning,'), findsOneWidget);
    expect(find.text('Rahul'), findsOneWidget);
    expect(find.text('Tue, 12 Sep 2024'), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);

    // Verify Primary KPI metrics
    expect(find.text('Total Leads'), findsOneWidget);
    expect(find.text('48'), findsOneWidget);
    expect(find.text('Called'), findsWidgets);
    expect(find.text('42'), findsOneWidget);
    expect(find.text('Connected'), findsWidgets);
    expect(find.text('30'), findsOneWidget);

    // Verify Secondary KPI metrics
    expect(find.text('Sold Orders'), findsOneWidget);
    expect(find.text('Sold Value'), findsOneWidget);
    expect(find.text('Hot'), findsOneWidget);

    // Verify Charts & Sections
    expect(find.text('Lead Activity Trend'), findsOneWidget);
    expect(find.text('Follow-up Trend'), findsOneWidget);
    expect(find.text('Follow-up Outcomes'), findsOneWidget);
    expect(find.text('Conversion Timeline'), findsOneWidget);
    expect(find.text('Follow-up Conversion Rate'), findsOneWidget);

    // Verify Bottom Navigation
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Leads'), findsOneWidget);
    expect(find.text('Calls'), findsOneWidget);
    expect(find.text('Orders'), findsOneWidget);
    expect(find.text('WhatsApp'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });

  testWidgets('DashboardPage quick call action opens dialer bottom sheet', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.5;

    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        home: DashboardPage(initialData: DashboardData.sample()),
      ),
    );
    await tester.pumpAndSettle();

    // Tap the floating Calls action button
    await tester.tap(find.text('Calls'));
    await tester.pumpAndSettle();

    // Bottom sheet is displayed
    expect(find.text('Acefone Quick Dialer'), findsOneWidget);
    expect(find.text('Call Next Queued Lead (Sunil Kumar)'), findsOneWidget);
  });

  testWidgets('DashboardPage tapping More opens MoreOptions with Reports & Analytics inside', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.5;

    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        home: DashboardPage(initialData: DashboardData.sample()),
      ),
    );
    await tester.pumpAndSettle();

    // Tap 'More' on bottom navigation
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();

    // Verify Reports is moved inside More
    expect(find.text('More Options'), findsOneWidget);
    expect(find.text('Reports & Analytics'), findsOneWidget);
  });

  testWidgets('DashboardPage tapping WhatsApp tab navigates to WhatsApp CRM screen', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.5;

    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: AppRouter.generateRoute,
        home: DashboardPage(initialData: DashboardData.sample()),
      ),
    );
    await tester.pumpAndSettle();

    // Tap 'WhatsApp' on bottom navigation
    await tester.tap(find.text('WhatsApp'));
    await tester.pumpAndSettle();

    // Verify WhatsApp CRM screen renders
    expect(find.text('WhatsApp CRM'), findsOneWidget);
    expect(find.text('All'), findsOneWidget);
  });
}
