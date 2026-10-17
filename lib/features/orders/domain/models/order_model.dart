import 'package:flutter/material.dart';

enum OrderStatus {
  draft,
  billed,
  packed,
  shipped,
  delivered,
  cancelled,
}

enum OrderSource {
  lead,
  dealer,
}

class OrderItem {
  final String productName;
  final int quantity;
  final double unitPrice;
  final String? imageAsset;
  final String? imageUrl;
  final String packSize;
  final String? sku;

  const OrderItem({
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    this.imageAsset,
    this.imageUrl,
    this.packSize = 'Piece',
    this.sku,
  });

  double get subtotal => quantity * unitPrice;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final name = json['product_name']?.toString() ?? 'SGB Agri Equipment';
    final qty = (json['quantity'] is num)
        ? (json['quantity'] as num).toInt()
        : (int.tryParse(json['quantity']?.toString() ?? '1') ?? 1);
    final price = (json['price'] is num)
        ? (json['price'] as num).toDouble()
        : (double.tryParse(json['price']?.toString() ?? '0') ?? 0.0);
    final imgUrl = json['image_url']?.toString();
    final unit = json['pack_size']?.toString() ?? json['unit']?.toString();
    final sku = json['sku']?.toString();

    return OrderItem(
      productName: name,
      quantity: qty,
      unitPrice: price,
      imageUrl: (imgUrl != null && imgUrl.isNotEmpty) ? imgUrl : null,
      imageAsset: null,
      packSize: (unit != null && unit.trim().isNotEmpty) ? unit.trim() : 'Piece',
      sku: sku,
    );
  }
}

class OrderModel {
  final String orderId;
  final String customerName;
  final String phone;
  final OrderSource source;
  final OrderStatus status;
  final List<OrderItem> items;
  final double totalAmount;
  final double advanceAmount;
  final double balanceAmount;
  final String paymentMode; // 'UPI / PhonePe', 'Cash on Delivery', 'Bank NEFT'
  final String address;
  final String village;
  final String district;
  final String state;
  final String pincode;
  final String createdAt;
  final String? courier;
  final String? trackingNumber;
  final String? assignedTelecaller;

  const OrderModel({
    required this.orderId,
    required this.customerName,
    required this.phone,
    this.source = OrderSource.lead,
    this.status = OrderStatus.billed,
    required this.items,
    required this.totalAmount,
    this.advanceAmount = 0.0,
    required this.balanceAmount,
    this.paymentMode = 'UPI / PhonePe',
    required this.address,
    required this.village,
    required this.district,
    this.state = 'Rajasthan',
    this.pincode = '304021',
    required this.createdAt,
    this.courier,
    this.trackingNumber,
    this.assignedTelecaller = 'Rahul Sharma',
  });

  static OrderStatus parseStatus(String? status) {
    final s = (status ?? '').toLowerCase().trim();
    if (s.contains('draft')) return OrderStatus.draft;
    if (s.contains('pack')) return OrderStatus.packed;
    if (s.contains('ship')) return OrderStatus.shipped;
    if (s.contains('deliver')) return OrderStatus.delivered;
    if (s.contains('cancel')) return OrderStatus.cancelled;
    return OrderStatus.billed;
  }

  static OrderSource parseSource(String? source) {
    final s = (source ?? '').toLowerCase().trim();
    if (s.contains('dealer')) return OrderSource.dealer;
    return OrderSource.lead;
  }

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>?) ?? [];
    final List<OrderItem> items = rawItems
        .whereType<Map<String, dynamic>>()
        .map((i) => OrderItem.fromJson(i))
        .toList();

    if (items.isEmpty && json['product_name'] != null) {
      items.add(
        OrderItem(
          productName: json['product_name'].toString(),
          quantity: int.tryParse(json['quantity']?.toString() ?? '1') ?? 1,
          unitPrice: double.tryParse(json['price']?.toString() ?? '0') ?? 0.0,
          imageUrl: json['image_url']?.toString(),
          imageAsset: null,
          packSize: json['pack_size']?.toString() ?? 'Piece',
          sku: json['sku']?.toString(),
        ),
      );
    }

    final total = double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0;
    final advance = double.tryParse(json['advance_amount']?.toString() ?? '0') ?? 0.0;
    final balance = double.tryParse(json['balance_amount']?.toString() ?? '0') ?? (total - advance);

    return OrderModel(
      orderId: 'SGB-${json['order_id'] ?? 'ORD'}',
      customerName: json['customer_name']?.toString() ?? 'Customer #${json['order_id']}',
      phone: json['phone']?.toString() ?? '',
      source: parseSource(json['order_source']?.toString()),
      status: parseStatus(json['order_status']?.toString()),
      items: items,
      totalAmount: total,
      advanceAmount: advance,
      balanceAmount: balance,
      paymentMode: json['delivery_type']?.toString() ?? 'Cash on Delivery',
      address: json['address']?.toString() ?? '',
      village: json['village']?.toString() ?? '',
      district: json['district']?.toString() ?? '',
      state: json['state']?.toString() ?? 'India',
      pincode: json['pincode']?.toString() ?? '',
      createdAt: json['created_at'] != null ? json['created_at'].toString().split('T').first : 'Recent',
      courier: json['courier_name']?.toString(),
      trackingNumber: json['tracking_id']?.toString(),
      assignedTelecaller: json['created_by_name']?.toString() ?? 'Telecaller',
    );
  }

  String get statusDisplay {
    switch (status) {
      case OrderStatus.draft:
        return 'Draft';
      case OrderStatus.billed:
        return 'Billed';
      case OrderStatus.packed:
        return 'Packed';
      case OrderStatus.shipped:
        return 'Shipped';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
    }
  }

  Color get statusColor {
    switch (status) {
      case OrderStatus.draft:
        return const Color(0xFF64748B);
      case OrderStatus.billed:
        return const Color(0xFFD97706);
      case OrderStatus.packed:
        return const Color(0xFF7C3AED);
      case OrderStatus.shipped:
        return const Color(0xFF0284C7);
      case OrderStatus.delivered:
        return const Color(0xFF16A34A);
      case OrderStatus.cancelled:
        return const Color(0xFFDC2626);
    }
  }

  Color get statusBgColor {
    switch (status) {
      case OrderStatus.draft:
        return const Color(0xFFF1F5F9);
      case OrderStatus.billed:
        return const Color(0xFFFEF3C7);
      case OrderStatus.packed:
        return const Color(0xFFF3E8FF);
      case OrderStatus.shipped:
        return const Color(0xFFE0F2FE);
      case OrderStatus.delivered:
        return const Color(0xFFDCFCE7);
      case OrderStatus.cancelled:
        return const Color(0xFFFEE2E2);
    }
  }

  OrderModel copyWith({
    String? orderId,
    String? customerName,
    String? phone,
    OrderSource? source,
    OrderStatus? status,
    List<OrderItem>? items,
    double? totalAmount,
    double? advanceAmount,
    double? balanceAmount,
    String? paymentMode,
    String? address,
    String? village,
    String? district,
    String? state,
    String? pincode,
    String? createdAt,
    String? courier,
    String? trackingNumber,
    String? assignedTelecaller,
  }) {
    return OrderModel(
      orderId: orderId ?? this.orderId,
      customerName: customerName ?? this.customerName,
      phone: phone ?? this.phone,
      source: source ?? this.source,
      status: status ?? this.status,
      items: items ?? this.items,
      totalAmount: totalAmount ?? this.totalAmount,
      advanceAmount: advanceAmount ?? this.advanceAmount,
      balanceAmount: balanceAmount ?? this.balanceAmount,
      paymentMode: paymentMode ?? this.paymentMode,
      address: address ?? this.address,
      village: village ?? this.village,
      district: district ?? this.district,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      createdAt: createdAt ?? this.createdAt,
      courier: courier ?? this.courier,
      trackingNumber: trackingNumber ?? this.trackingNumber,
      assignedTelecaller: assignedTelecaller ?? this.assignedTelecaller,
    );
  }

  static List<OrderModel> sampleOrders() {
    return [
      const OrderModel(
        orderId: 'SGB-2024-09-108',
        customerName: 'Ramesh Kumar',
        phone: '+91 98765 43210',
        source: OrderSource.lead,
        status: OrderStatus.billed,
        items: [
          OrderItem(
            productName: 'SGB Organic Fertilizer 50kg',
            quantity: 10,
            unitPrice: 1000.0,
            imageAsset: 'assets/images/fertilizer_bag.jpg',
            packSize: '50 kg Bag',
          ),
          OrderItem(
            productName: 'Pure Neem Oil Bio-Pesticide',
            quantity: 2,
            unitPrice: 1000.0,
            imageAsset: 'assets/images/neem_oil.jpg',
            packSize: '1 Litre Bottle',
          ),
        ],
        totalAmount: 12000.0,
        advanceAmount: 3000.0,
        balanceAmount: 9000.0,
        paymentMode: 'UPI / PhonePe',
        address: 'Plot 42, Kisan Mandi Road, Niwai',
        village: 'Niwai',
        district: 'Tonk',
        state: 'Rajasthan',
        pincode: '304021',
        createdAt: '12 Sep 2024, 10:45 AM',
        courier: 'SGB Rural Express',
        trackingNumber: 'SGB-EXP-9182',
      ),
      const OrderModel(
        orderId: 'SGB-2024-09-105',
        customerName: 'Priya Singh',
        phone: '+91 87654 32109',
        source: OrderSource.lead,
        status: OrderStatus.packed,
        items: [
          OrderItem(
            productName: 'Crop Growth Booster Formula',
            quantity: 5,
            unitPrice: 1200.0,
            imageAsset: 'assets/images/growth_booster.jpg',
            packSize: '500 ml Bottle',
          ),
          OrderItem(
            productName: 'SGB Organic Fertilizer 50kg',
            quantity: 6,
            unitPrice: 1000.0,
            imageAsset: 'assets/images/fertilizer_bag.jpg',
            packSize: '50 kg Bag',
          ),
        ],
        totalAmount: 12000.0,
        advanceAmount: 12000.0,
        balanceAmount: 0.0,
        paymentMode: 'UPI Verified (Full Paid)',
        address: 'Near Gram Panchayat Bhawan, Kishangarh',
        village: 'Kishangarh',
        district: 'Ajmer',
        state: 'Rajasthan',
        pincode: '305801',
        createdAt: '12 Sep 2024, 09:30 AM',
        courier: 'V-Trans Logistics',
        trackingNumber: 'VT-AJM-4401',
      ),
      const OrderModel(
        orderId: 'SGB-2024-09-101',
        customerName: 'Amit Patel',
        phone: '+91 78965 43210',
        source: OrderSource.dealer,
        status: OrderStatus.shipped,
        items: [
          OrderItem(
            productName: 'SGB Organic Fertilizer 50kg',
            quantity: 40,
            unitPrice: 950.0,
            imageAsset: 'assets/images/fertilizer_bag.jpg',
            packSize: '50 kg Bag',
          ),
          OrderItem(
            productName: 'Pure Neem Oil Bio-Pesticide',
            quantity: 10,
            unitPrice: 900.0,
            imageAsset: 'assets/images/neem_oil.jpg',
            packSize: '1 Litre Bottle',
          ),
        ],
        totalAmount: 47000.0,
        advanceAmount: 20000.0,
        balanceAmount: 27000.0,
        paymentMode: 'Bank NEFT',
        address: 'Shree Kripa Agro Center, Main Mandi Gate',
        village: 'Ramganj Mandi',
        district: 'Kota',
        state: 'Rajasthan',
        pincode: '326519',
        createdAt: '11 Sep 2024, 04:15 PM',
        courier: 'Gati KWE Heavy Logistics',
        trackingNumber: 'GATI-KT-8819',
      ),
      const OrderModel(
        orderId: 'SGB-2024-09-098',
        customerName: 'Sunita Devi',
        phone: '+91 91234 56789',
        source: OrderSource.lead,
        status: OrderStatus.delivered,
        items: [
          OrderItem(
            productName: 'Crop Growth Booster Formula',
            quantity: 3,
            unitPrice: 1200.0,
            imageAsset: 'assets/images/growth_booster.jpg',
            packSize: '500 ml Bottle',
          ),
        ],
        totalAmount: 3600.0,
        advanceAmount: 3600.0,
        balanceAmount: 0.0,
        paymentMode: 'Cash on Delivery (Collected)',
        address: 'Kisan Basti, Ward 3, Chomu',
        village: 'Chomu',
        district: 'Jaipur',
        state: 'Rajasthan',
        pincode: '303702',
        createdAt: '10 Sep 2024, 02:00 PM',
        courier: 'SGB Rural Express',
        trackingNumber: 'SGB-DEL-1029',
      ),
      const OrderModel(
        orderId: 'SGB-2024-09-094',
        customerName: 'Vikram Reddy',
        phone: '+91 89012 34567',
        source: OrderSource.lead,
        status: OrderStatus.draft,
        items: [
          OrderItem(
            productName: 'SGB Organic Fertilizer 50kg',
            quantity: 15,
            unitPrice: 1000.0,
            imageAsset: 'assets/images/fertilizer_bag.jpg',
            packSize: '50 kg Bag',
          ),
        ],
        totalAmount: 15000.0,
        advanceAmount: 0.0,
        balanceAmount: 15000.0,
        paymentMode: 'Awaiting Advance Confirmation',
        address: 'Near Old Bus Stand, Shahpura',
        village: 'Shahpura',
        district: 'Bhilwara',
        state: 'Rajasthan',
        pincode: '311404',
        createdAt: '12 Sep 2024, 11:20 AM',
      ),
    ];
  }
}
