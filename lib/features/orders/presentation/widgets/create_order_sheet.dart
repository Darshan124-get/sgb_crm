import 'package:flutter/material.dart';
import '../../domain/models/order_model.dart';

class CreateOrderSheet extends StatefulWidget {
  final ValueChanged<OrderModel> onOrderCreated;

  const CreateOrderSheet({
    super.key,
    required this.onOrderCreated,
  });

  static void show(BuildContext context, {required ValueChanged<OrderModel> onOrderCreated}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CreateOrderSheet(onOrderCreated: onOrderCreated),
    );
  }

  @override
  State<CreateOrderSheet> createState() => _CreateOrderSheetState();
}

class _CreateOrderSheetState extends State<CreateOrderSheet> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _villageCtrl = TextEditingController();
  final _districtCtrl = TextEditingController();
  final _advanceCtrl = TextEditingController(text: '3000');

  int _fertilizerQty = 10; // ₹1,000 each
  int _neemOilQty = 2; // ₹1,000 each
  int _boosterQty = 0; // ₹1,200 each
  String _paymentMode = 'UPI / PhonePe';

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _villageCtrl.dispose();
    _districtCtrl.dispose();
    _advanceCtrl.dispose();
    super.dispose();
  }

  double get _totalAmount {
    return (_fertilizerQty * 1000.0) + (_neemOilQty * 1000.0) + (_boosterQty * 1200.0);
  }

  double get _advanceAmount {
    return double.tryParse(_advanceCtrl.text.trim()) ?? 0.0;
  }

  double get _balanceAmount {
    final bal = _totalAmount - _advanceAmount;
    return bal > 0 ? bal : 0.0;
  }

  void _submit() {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final village = _villageCtrl.text.trim();
    final district = _districtCtrl.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter farmer name and phone number'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_totalAmount == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least 1 product quantity'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final items = <OrderItem>[];
    if (_fertilizerQty > 0) {
      items.add(OrderItem(
        productName: 'SGB Organic Fertilizer 50kg',
        quantity: _fertilizerQty,
        unitPrice: 1000.0,
        imageAsset: 'assets/images/fertilizer_bag.jpg',
        packSize: '50 kg Bag',
      ));
    }
    if (_neemOilQty > 0) {
      items.add(OrderItem(
        productName: 'Pure Neem Oil Bio-Pesticide',
        quantity: _neemOilQty,
        unitPrice: 1000.0,
        imageAsset: 'assets/images/neem_oil.jpg',
        packSize: '1 Litre Bottle',
      ));
    }
    if (_boosterQty > 0) {
      items.add(OrderItem(
        productName: 'Crop Growth Booster Formula',
        quantity: _boosterQty,
        unitPrice: 1200.0,
        imageAsset: 'assets/images/growth_booster.jpg',
        packSize: '500 ml Bottle',
      ));
    }

    final orderId = 'SGB-2024-09-${110 + DateTime.now().second}';

    final newOrder = OrderModel(
      orderId: orderId,
      customerName: name,
      phone: phone.startsWith('+91') ? phone : '+91 $phone',
      source: OrderSource.lead,
      status: _advanceAmount > 0 ? OrderStatus.billed : OrderStatus.draft,
      items: items,
      totalAmount: _totalAmount,
      advanceAmount: _advanceAmount,
      balanceAmount: _balanceAmount,
      paymentMode: _paymentMode,
      address: 'Main Gram Panchayat Road',
      village: village.isNotEmpty ? village : 'Kishanpur',
      district: district.isNotEmpty ? district : 'Jaipur',
      createdAt: 'Just now',
    );

    widget.onOrderCreated(newOrder);
    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Order $orderId booked successfully!'),
        backgroundColor: const Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
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
                const Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.add_shopping_cart_rounded, color: Color(0xFF0A5844), size: 22),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Book New Order (Telecaller)',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Farmer Basic Info
                  const Text('Farmer & Contact Details', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Farmer Name *',
                      hintText: 'e.g. Suresh Patel',
                      prefixIcon: const Icon(Icons.person_outline_rounded),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Mobile Number *',
                      hintText: '+91 98765 00000',
                      prefixIcon: const Icon(Icons.phone_outlined),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _villageCtrl,
                          decoration: InputDecoration(
                            labelText: 'Village / Tehsil',
                            hintText: 'Niwai',
                            prefixIcon: const Icon(Icons.holiday_village_outlined),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _districtCtrl,
                          decoration: InputDecoration(
                            labelText: 'District',
                            hintText: 'Tonk',
                            prefixIcon: const Icon(Icons.location_city_outlined),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // 2. Products Selector & Quantities
                  const Text('Select Products & Quantities', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 10),

                  _buildProductQuantityTile(
                    title: 'Organic Fertilizer 50kg',
                    price: '₹1,000 / bag',
                    qty: _fertilizerQty,
                    image: 'assets/images/fertilizer_bag.jpg',
                    onMinus: () {
                      if (_fertilizerQty > 0) setState(() => _fertilizerQty--);
                    },
                    onPlus: () => setState(() => _fertilizerQty++),
                  ),
                  const SizedBox(height: 8),

                  _buildProductQuantityTile(
                    title: 'Neem Oil Bio-Pesticide 1L',
                    price: '₹1,000 / bottle',
                    qty: _neemOilQty,
                    image: 'assets/images/neem_oil.jpg',
                    onMinus: () {
                      if (_neemOilQty > 0) setState(() => _neemOilQty--);
                    },
                    onPlus: () => setState(() => _neemOilQty++),
                  ),
                  const SizedBox(height: 8),

                  _buildProductQuantityTile(
                    title: 'Growth Booster 500ml',
                    price: '₹1,200 / bottle',
                    qty: _boosterQty,
                    image: 'assets/images/growth_booster.jpg',
                    onMinus: () {
                      if (_boosterQty > 0) setState(() => _boosterQty--);
                    },
                    onPlus: () => setState(() => _boosterQty++),
                  ),

                  const SizedBox(height: 20),

                  // 3. Financials & Payment Mode
                  const Text('Financials & Payment', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 10),

                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Order Subtotal', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF166534))),
                            Text('₹${_totalAmount.toInt()}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                          ],
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _advanceCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Advance Payment Received (₹)',
                            prefixIcon: const Icon(Icons.currency_rupee_rounded, size: 18),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Balance Due on COD', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                            Text('₹${_balanceAmount.toInt()}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Payment mode dropdown
                  DropdownButtonFormField<String>(
                    value: _paymentMode,
                    decoration: InputDecoration(
                      labelText: 'Payment Mode',
                      prefixIcon: const Icon(Icons.payments_outlined),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'UPI / PhonePe', child: Text('UPI / PhonePe (Instant)')),
                      DropdownMenuItem(value: 'Cash on Delivery', child: Text('Cash on Delivery (COD)')),
                      DropdownMenuItem(value: 'Bank NEFT', child: Text('Bank NEFT Transfer')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _paymentMode = val);
                    },
                  ),

                  const SizedBox(height: 24),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _submit,
                      icon: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                      label: const Text(
                        'Confirm & Book Order',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0A5844),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductQuantityTile({
    required String title,
    required String price,
    required int qty,
    required String image,
    required VoidCallback onMinus,
    required VoidCallback onPlus,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(8)),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(image, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                Text(price, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.remove, size: 14),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: onMinus,
                ),
                Text('$qty', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                IconButton(
                  icon: const Icon(Icons.add, size: 14),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: onPlus,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
