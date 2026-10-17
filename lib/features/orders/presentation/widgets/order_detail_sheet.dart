import 'package:flutter/material.dart';
import '../../../../core/network/api_config.dart';
import '../../domain/models/order_model.dart';

class OrderDetailSheet extends StatefulWidget {
  final OrderModel order;
  final ValueChanged<OrderModel>? onOrderUpdated;

  const OrderDetailSheet({
    super.key,
    required this.order,
    this.onOrderUpdated,
  });

  static void show(
    BuildContext context, {
    required OrderModel order,
    ValueChanged<OrderModel>? onOrderUpdated,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => OrderDetailSheet(
        order: order,
        onOrderUpdated: onOrderUpdated,
      ),
    );
  }

  @override
  State<OrderDetailSheet> createState() => _OrderDetailSheetState();
}

class _OrderDetailSheetState extends State<OrderDetailSheet> {
  late OrderModel _order;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle Bar
          Container(
            width: 38,
            height: 4,
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(10),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _order.orderId,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Created on ${_order.createdAt}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _order.statusBgColor,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _order.statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _order.statusDisplay,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: _order.statusColor,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Status Stepper / Pipeline
                  const Text(
                    'Order Pipeline & Dispatch Status',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 10),
                  _buildStatusPipeline(),

                  const SizedBox(height: 18),

                  // 2. Customer & Delivery Address Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.location_on_rounded, size: 16, color: Color(0xFF0A5844)),
                            SizedBox(width: 6),
                            Text(
                              'Delivery & Customer Details',
                              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0A5844)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _order.customerName,
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          _order.phone,
                          style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Builder(
                          builder: (context) {
                            final parts = <String>[];
                            if (_order.address.trim().isNotEmpty) parts.add(_order.address.trim());
                            if (_order.village.trim().isNotEmpty) parts.add(_order.village.trim());
                            if (_order.district.trim().isNotEmpty) parts.add('Dist. ${_order.district.trim()}');
                            if (_order.state.trim().isNotEmpty) parts.add(_order.state.trim());
                            if (_order.pincode.trim().isNotEmpty) parts.add(_order.pincode.trim());
                            final text = parts.isNotEmpty ? parts.join(', ') : 'Address not specified';
                            return Text(
                              text,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 18),

                  // 3. Itemized Product List
                  const Text(
                    'Order Items & Packages',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: _order.items.map((item) {
                        return Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              _buildProductThumbnail(item),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.productName,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _buildItemSubtitle(item),
                                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '₹${item.subtotal.toInt()}',
                                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 18),

                  // 4. Financial Summary Breakdown Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Column(
                      children: [
                        _buildPriceRow('Total Order Value', '₹${_order.totalAmount.toInt()}', isBold: false),
                        const SizedBox(height: 6),
                        _buildPriceRow('Advance Payment (${_order.paymentMode})', '₹${_order.advanceAmount.toInt()}', isGreen: true),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Divider(height: 1, color: Color(0xFFBBF7D0)),
                        ),
                        _buildPriceRow(
                          'Balance Due (on Delivery)',
                          '₹${_order.balanceAmount.toInt()}',
                          isBold: true,
                          isRed: _order.balanceAmount > 0,
                          fontSize: 16,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 18),

                  // 5. Courier & Tracking (if shipped/delivered)
                  if (_order.courier != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.local_shipping_rounded, color: Color(0xFF0284C7), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Courier: ${_order.courier}',
                                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                                if (_order.trackingNumber != null)
                                  Text(
                                    'Docket / Track: ${_order.trackingNumber}',
                                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPipeline() {
    final stages = [
      OrderStatus.draft,
      OrderStatus.billed,
      OrderStatus.packed,
      OrderStatus.shipped,
      OrderStatus.delivered,
    ];
    final currentIndex = stages.indexOf(_order.status);

    return Row(
      children: List.generate(stages.length, (idx) {
        final isPassed = currentIndex >= idx;
        final isCurrent = currentIndex == idx;
        final stage = stages[idx];

        String label;
        switch (stage) {
          case OrderStatus.draft:
            label = 'Draft';
            break;
          case OrderStatus.billed:
            label = 'Bill';
            break;
          case OrderStatus.packed:
            label = 'Pack';
            break;
          case OrderStatus.shipped:
            label = 'Ship';
            break;
          case OrderStatus.delivered:
            label = 'Done';
            break;
          default:
            label = '';
        }

        return Expanded(
          child: Column(
            children: [
              Row(
                children: [
                  if (idx > 0)
                    Expanded(
                      child: Container(
                        height: 3,
                        color: isPassed ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                      ),
                    ),
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: isPassed ? const Color(0xFF10B981) : const Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isCurrent ? const Color(0xFF047857) : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: isPassed
                          ? const Icon(Icons.check, size: 13, color: Colors.white)
                          : Text(
                              '${idx + 1}',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                  if (idx < stages.length - 1)
                    Expanded(
                      child: Container(
                        height: 3,
                        color: currentIndex > idx ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
                  color: isCurrent ? const Color(0xFF0A5844) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildPriceRow(String label, String value, {bool isBold = false, bool isGreen = false, bool isRed = false, double fontSize = 13}) {
    Color valColor = const Color(0xFF0F172A);
    if (isGreen) valColor = const Color(0xFF16A34A);
    if (isRed) valColor = const Color(0xFFDC2626);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            color: isBold ? const Color(0xFF0F172A) : const Color(0xFF475569),
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            color: valColor,
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
          ),
        ),
      ],
    );
  }

  String _buildItemSubtitle(OrderItem item) {
    final parts = <String>[];
    if (item.sku != null && item.sku!.isNotEmpty) {
      parts.add('SKU: ${item.sku}');
    } else if (item.packSize.isNotEmpty &&
        item.packSize.toLowerCase() != 'piece' &&
        item.packSize.toLowerCase() != 'standard unit') {
      parts.add(item.packSize);
    }
    parts.add('Qty: ${item.quantity}');
    return parts.join(' • ');
  }

  Widget _buildProductThumbnail(OrderItem item) {
    if (item.imageUrl != null && item.imageUrl!.isNotEmpty) {
      final url = item.imageUrl!;
      final baseUrl = ApiConfig.baseUrl.replaceAll('/api', '');
      final cleanUrl = url.startsWith('/') ? url.substring(1) : url;
      final fullUrl = url.startsWith('http') ? url : '$baseUrl/$cleanUrl';
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          fullUrl,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildEquipmentIcon(item.productName),
        ),
      );
    }

    if (item.imageAsset != null &&
        item.imageAsset!.isNotEmpty &&
        !item.imageAsset!.contains('fertilizer_bag')) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.asset(
          item.imageAsset!,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildEquipmentIcon(item.productName),
        ),
      );
    }

    return _buildEquipmentIcon(item.productName);
  }

  Widget _buildEquipmentIcon(String name) {
    final lower = name.toLowerCase();
    IconData icon = Icons.agriculture_rounded;
    Color iconColor = const Color(0xFF059669);
    Color bgColor = const Color(0xFFECFDF5);

    if (lower.contains('roller')) {
      icon = Icons.sync_rounded;
      iconColor = const Color(0xFF0284C7);
      bgColor = const Color(0xFFE0F2FE);
    } else if (lower.contains('trolley') || lower.contains('barrow') || lower.contains('dumper')) {
      icon = Icons.local_shipping_outlined;
      iconColor = const Color(0xFFD97706);
      bgColor = const Color(0xFFFEF3C7);
    } else if (lower.contains('cutter') || lower.contains('blade')) {
      icon = Icons.content_cut_rounded;
      iconColor = const Color(0xFF059669);
      bgColor = const Color(0xFFDCFCE7);
    } else if (lower.contains('weeder')) {
      icon = Icons.grass_rounded;
      iconColor = const Color(0xFF16A34A);
      bgColor = const Color(0xFFDCFCE7);
    } else if (lower.contains('machine')) {
      icon = Icons.build_circle_outlined;
      iconColor = const Color(0xFF4F46E5);
      bgColor = const Color(0xFFEEF2FF);
    }

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: iconColor.withValues(alpha: 0.25)),
      ),
      child: Center(
        child: Icon(icon, size: 22, color: iconColor),
      ),
    );
  }
}
