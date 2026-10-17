import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/app/router/app_router.dart';
import 'package:sgbconnect/features/dashboard/domain/models/dashboard_data.dart';
import 'package:sgbconnect/features/dashboard/presentation/pages/dashboard_page.dart';
import 'package:sgbconnect/features/orders/domain/models/order_model.dart';
import 'package:sgbconnect/features/orders/presentation/pages/orders_page.dart';
import 'package:sgbconnect/features/orders/presentation/widgets/create_order_sheet.dart';
import 'package:sgbconnect/features/orders/presentation/widgets/order_detail_sheet.dart';
import 'package:sgbconnect/features/orders/presentation/widgets/order_skeleton_loader.dart';

void main() {
  group('OrdersPage Widget Tests', () {
    testWidgets('OrdersPage renders skeleton loader when loading initial state', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OrdersPage(initialOrders: null),
        ),
      );
      expect(find.byType(OrderSkeletonList), findsOneWidget);
    });

    testWidgets('Renders OrdersPage with header, KPI cards, filter pills, and order list', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: OrdersPage(initialOrders: OrderModel.sampleOrders()),
        ),
      );
      await tester.pumpAndSettle();

      // Header
      expect(find.text('Orders & Bookings'), findsOneWidget);
      expect(find.text('Telecaller Pipeline • SGB Agro CRM'), findsOneWidget);

      // KPI cards and status indicators
      expect(find.text('Total Value'), findsOneWidget);
      expect(find.text('Drafts'), findsWidgets);
      expect(find.text('Billed'), findsWidgets);
      expect(find.text('Packed'), findsWidgets);
      expect(find.text('Shipped'), findsWidgets);
      expect(find.text('Delivered'), findsWidgets);

      // Filter tabs
      expect(find.text('All Orders'), findsOneWidget);

      // Orders rendered from sample data
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('SGB-2024-09-108'), findsOneWidget);
      expect(find.text('Priya Singh'), findsOneWidget);
      expect(find.text('Amit Patel'), findsOneWidget);

      // Action button in AppBar (floating button removed)
      expect(find.byIcon(Icons.add_circle_outline_rounded), findsOneWidget);
      expect(find.text('Book Order'), findsNothing);
    });

    testWidgets('Filtering by Packed status tab displays only packed orders', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: OrdersPage(initialOrders: OrderModel.sampleOrders()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Packed' filter tab
      await tester.tap(find.byKey(const ValueKey('filter_tab_packed')));
      await tester.pumpAndSettle();

      // Priya Singh is Packed
      expect(find.text('Priya Singh'), findsOneWidget);
      // Ramesh Kumar is Billed (should not be in packed list)
      expect(find.text('Ramesh Kumar'), findsNothing);
    });

    testWidgets('Tapping order card opens OrderDetailSheet with pipeline and status updates', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final sample = OrderModel.sampleOrders().first;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrderDetailSheet(
              order: sample,
              onOrderUpdated: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Order ID
      expect(find.text(sample.orderId), findsOneWidget);
      expect(find.text('Delivery & Customer Details'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Order Items & Packages'), findsOneWidget);
      expect(find.text('Total Order Value'), findsOneWidget);
      expect(find.text('Balance Due (on Delivery)'), findsOneWidget);

      // Status stepper & verification that manual update buttons are removed
      expect(find.text('Order Pipeline & Dispatch Status'), findsOneWidget);
      expect(find.text('Update Status Now'), findsNothing);
    });

    testWidgets('CreateOrderSheet allows booking a new order', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;

      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      OrderModel? createdOrder;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreateOrderSheet(
              onOrderCreated: (order) {
                createdOrder = order;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Book New Order (Telecaller)'), findsOneWidget);

      // Enter Name & Phone
      final nameField = find.widgetWithText(TextField, 'Farmer Name *');
      final phoneField = find.widgetWithText(TextField, 'Mobile Number *');

      await tester.enterText(nameField, 'Mahesh Choudhary');
      await tester.enterText(phoneField, '9829012345');
      await tester.pumpAndSettle();

      // Tap Confirm & Book Order
      await tester.tap(find.text('Confirm & Book Order'));
      await tester.pumpAndSettle();

      expect(createdOrder, isNotNull);
      expect(createdOrder!.customerName, equals('Mahesh Choudhary'));
      expect(createdOrder!.totalAmount, greaterThan(0));
    });

    testWidgets('DashboardPage tapping Orders bottom nav tab navigates to OrdersPage', (WidgetTester tester) async {
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

      // Tap 'Orders' on bottom navigation
      await tester.tap(find.text('Orders'));
      await tester.pumpAndSettle();

      // Verify OrdersPage renders
      expect(find.text('Orders & Bookings'), findsOneWidget);
      expect(find.text('All Orders'), findsOneWidget);
    });
  });
}
