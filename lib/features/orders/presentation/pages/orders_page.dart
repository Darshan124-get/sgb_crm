import 'package:flutter/material.dart';
import '../../../dashboard/presentation/widgets/dashboard_bottom_nav.dart';
import '../../../dashboard/presentation/widgets/more_options_bottom_sheet.dart';
import '../../data/order_service.dart';
import '../../domain/models/order_model.dart';
import '../../../whatsapp/domain/models/whatsapp_model.dart';
import '../../../whatsapp/presentation/pages/whatsapp_chat_page.dart';
import '../widgets/create_order_sheet.dart';
import '../widgets/order_card.dart';
import '../widgets/order_detail_sheet.dart';
import '../widgets/order_skeleton_loader.dart';
import '../../../../core/constants/app_illustrations.dart';
import '../../../../core/widgets/app_illustration_view.dart';

class OrdersPage extends StatefulWidget {
  final List<OrderModel>? initialOrders;

  const OrdersPage({
    super.key,
    this.initialOrders,
  });

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  late List<OrderModel> _orders;
  bool _isLoading = false;
  String _activeStatus = 'all'; // 'all', 'draft', 'billed', 'packed', 'shipped', 'delivered'
  final String _sourceFilter = 'all'; // 'all', 'lead', 'dealer'
  String _searchQuery = '';
  bool _isSearching = false;
  final TextEditingController _searchCtrl = TextEditingController();

  static const Color primaryGreen = Color(0xFF0A5844);

  @override
  void initState() {
    super.initState();
    _orders = widget.initialOrders ?? [];
    _isLoading = widget.initialOrders == null;
    if (widget.initialOrders == null) {
      _loadOrders();
    }
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    try {
      final liveOrders = await OrderService.getOrders();
      if (!mounted) return;
      setState(() {
        _orders = liveOrders;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<OrderModel> get _filteredOrders {
    return _orders.where((o) {
      // Status filter
      if (_activeStatus != 'all') {
        if (o.statusDisplay.toLowerCase() != _activeStatus.toLowerCase()) {
          return false;
        }
      }

      // Source filter
      if (_sourceFilter == 'lead' && o.source != OrderSource.lead) return false;
      if (_sourceFilter == 'dealer' && o.source != OrderSource.dealer) return false;

      // Search query
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchId = o.orderId.toLowerCase().contains(q);
        final matchName = o.customerName.toLowerCase().contains(q);
        final matchPhone = o.phone.replaceAll(' ', '').contains(q.replaceAll(' ', ''));
        final matchVillage = o.village.toLowerCase().contains(q);
        final matchDistrict = o.district.toLowerCase().contains(q);
        if (!matchId && !matchName && !matchPhone && !matchVillage && !matchDistrict) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  double get _totalRevenue => _orders.fold(0.0, (sum, o) => sum + o.totalAmount);
  int get _draftCount => _orders.where((o) => o.status == OrderStatus.draft).length;
  int get _billedCount => _orders.where((o) => o.status == OrderStatus.billed).length;
  int get _packedCount => _orders.where((o) => o.status == OrderStatus.packed).length;
  int get _shippedCount => _orders.where((o) => o.status == OrderStatus.shipped).length;
  int get _deliveredCount => _orders.where((o) => o.status == OrderStatus.delivered).length;

  void _openOrderDetail(OrderModel order) {
    OrderDetailSheet.show(
      context,
      order: order,
      onOrderUpdated: (updated) {
        setState(() {
          final idx = _orders.indexWhere((o) => o.orderId == updated.orderId);
          if (idx != -1) {
            _orders[idx] = updated;
          }
        });
      },
    );
  }

  void _openCreateOrder() {
    CreateOrderSheet.show(
      context,
      onOrderCreated: (newOrder) {
        setState(() {
          _orders.insert(0, newOrder);
        });
      },
    );
  }

  void _callFarmer(OrderModel order) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Calling ${order.customerName} (${order.phone}) via Acefone...'),
        backgroundColor: primaryGreen,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _openWhatsApp(OrderModel order) {
    // Check if we have an existing WhatsApp conversation, or create a quick one
    final existingConvs = WhatsAppConversation.sampleConversations();
    final conv = existingConvs.firstWhere(
      (c) => c.phone.replaceAll(' ', '').contains(order.phone.replaceAll(' ', '')),
      orElse: () => WhatsAppConversation(
        id: 'conv_${order.orderId}',
        name: order.customerName,
        phone: order.phone,
        lastMessage: 'Order ${order.orderId} receipt: Total ₹${order.totalAmount.toInt()}',
        time: 'Just now',
        avatarBgColor: const Color(0xFFDCFCE7),
        avatarTextColor: const Color(0xFF166534),
        location: '${order.village}, ${order.district}',
        crop: 'Order #${order.orderId}',
        messages: [
          WhatsAppMessage(
            id: 'm_${DateTime.now().millisecondsSinceEpoch}',
            text: 'Namaste ${order.customerName} ji! Your order ${order.orderId} for ₹${order.totalAmount.toInt()} has been confirmed. Balance due on delivery: ₹${order.balanceAmount.toInt()}.',
            timestamp: 'Just now',
            isOutgoing: true,
            status: MessageStatus.sent,
          ),
        ],
      ),
    );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WhatsAppChatPage(conversation: conv),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredOrders;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(_isSearching ? 65 : 60),
        child: AppBar(
          backgroundColor: primaryGreen,
          elevation: 1,
          automaticallyImplyLeading: false,
          title: _isSearching
              ? TextField(
                  controller: _searchCtrl,
                  autofocus: true,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                  cursorColor: Colors.white,
                  decoration: InputDecoration(
                    hintText: 'Search order ID, farmer, village...',
                    hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
                    border: InputBorder.none,
                    prefixIcon: const Icon(Icons.search, color: Colors.white70),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () {
                        setState(() {
                          _isSearching = false;
                          _searchQuery = '';
                          _searchCtrl.clear();
                        });
                      },
                    ),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                )
              : const Row(
                  children: [
                    Icon(Icons.inventory_2_rounded, color: Colors.white, size: 22),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Orders & Bookings',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Telecaller Pipeline • SGB Agro CRM',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Color(0xFFBBF7D0),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
          actions: _isSearching
              ? []
              : [
                  IconButton(
                    icon: const Icon(Icons.search_rounded, color: Colors.white),
                    tooltip: 'Search Orders',
                    onPressed: () {
                      setState(() {
                        _isSearching = true;
                      });
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white),
                    tooltip: 'Book Order',
                    onPressed: _openCreateOrder,
                  ),
                ],
        ),
      ),
      body: Column(
        children: [
          // 1. KPI Stats Summary Strip
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildKpiCard('Total Value', '₹${_totalRevenue.toInt()}', Icons.currency_rupee_rounded, const Color(0xFF0A5844), const Color(0xFFDCFCE7)),
                  const SizedBox(width: 10),
                  _buildKpiCard('Drafts', '$_draftCount', Icons.edit_note_rounded, const Color(0xFF64748B), const Color(0xFFF1F5F9)),
                  const SizedBox(width: 10),
                  _buildKpiCard('Billed', '$_billedCount', Icons.receipt_long_rounded, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
                  const SizedBox(width: 10),
                  _buildKpiCard('Packed', '$_packedCount', Icons.inventory_rounded, const Color(0xFF7C3AED), const Color(0xFFF3E8FF)),
                  const SizedBox(width: 10),
                  _buildKpiCard('Shipped', '$_shippedCount', Icons.local_shipping_rounded, const Color(0xFF0284C7), const Color(0xFFE0F2FE)),
                  const SizedBox(width: 10),
                  _buildKpiCard('Delivered', '$_deliveredCount', Icons.check_circle_rounded, const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
                ],
              ),
            ),
          ),

          // 2. Status Filter Pills Bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildFilterTab(keyId: 'all', label: 'All Orders', count: _orders.length),
                  const SizedBox(width: 6),
                  _buildFilterTab(keyId: 'draft', label: 'Draft', count: _draftCount),
                  const SizedBox(width: 6),
                  _buildFilterTab(keyId: 'billed', label: 'Billed', count: _billedCount),
                  const SizedBox(width: 6),
                  _buildFilterTab(keyId: 'packed', label: 'Packed', count: _packedCount),
                  const SizedBox(width: 6),
                  _buildFilterTab(keyId: 'shipped', label: 'Shipped', count: _shippedCount),
                  const SizedBox(width: 6),
                  _buildFilterTab(keyId: 'delivered', label: 'Delivered', count: _deliveredCount),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          if (_isLoading)
            const LinearProgressIndicator(
              minHeight: 2.5,
              backgroundColor: Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(primaryGreen),
            ),

          // 3. Orders List
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadOrders,
              color: primaryGreen,
              child: _isLoading
                  ? const OrderSkeletonList()
                  : filtered.isEmpty
                      ? _buildEmptyState()
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: filtered.length,
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (ctx, index) {
                            final order = filtered[index];
                            return OrderCard(
                              order: order,
                              onTap: () => _openOrderDetail(order),
                              onCall: () => _callFarmer(order),
                              onWhatsApp: () => _openWhatsApp(order),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: DashboardBottomNav(
        currentIndex: 2, // Orders active tab
        onTabSelected: (index) {
          if (index == 0) {
            Navigator.of(context).pushReplacementNamed('/dashboard');
          } else if (index == 1) {
            Navigator.of(context).pushReplacementNamed('/leads');
          } else if (index == 2) {
            // Already here
          } else if (index == 3) {
            Navigator.of(context).pushReplacementNamed('/whatsapp');
          } else if (index == 4) {
            MoreOptionsBottomSheet.show(context);
          }
        },
        onCallPressed: () {
          Navigator.of(context).pushNamed('/calls');
        },
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, IconData icon, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: color),
              ),
              Text(
                label,
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab({
    required String keyId,
    required String label,
    required int count,
  }) {
    final isSelected = _activeStatus == keyId;
    return GestureDetector(
      key: ValueKey('filter_tab_$keyId'),
      onTap: () {
        setState(() {
          _activeStatus = keyId;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSelected ? primaryGreen : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? const Color(0xFF065F46) : const Color(0xFF475569),
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: isSelected ? primaryGreen : const Color(0xFF94A3B8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  count.toString(),
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    if (_searchQuery.isNotEmpty) {
      return AppIllustrationView(
        imagePath: AppIllustrations.emptySearch,
        title: 'No matching orders',
        subtitle: 'No orders match "$_searchQuery". Check the order ID, farmer name, or village.',
        actionLabel: 'Clear Search',
        fallbackIcon: Icons.search_off_rounded,
        onAction: () {
          setState(() {
            _searchQuery = '';
            _searchCtrl.clear();
            _isSearching = false;
          });
        },
      );
    }

    return AppIllustrationView(
      imagePath: AppIllustrations.noLeads,
      title: 'No orders found',
      subtitle: _activeStatus == 'all'
          ? 'No orders have been booked yet. Tap + Book Order to create a new order.'
          : 'No orders under "$_activeStatus" status.',
      actionLabel: _activeStatus == 'all' ? null : 'Reset Status Filter',
      fallbackIcon: Icons.inventory_2_outlined,
      onAction: _activeStatus == 'all'
          ? null
          : () {
              setState(() {
                _activeStatus = 'all';
              });
            },
    );
  }
}
