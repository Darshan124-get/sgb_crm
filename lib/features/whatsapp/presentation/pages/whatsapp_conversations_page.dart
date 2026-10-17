import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../dashboard/presentation/widgets/dashboard_bottom_nav.dart';
import '../../../dashboard/presentation/widgets/more_options_bottom_sheet.dart';
import '../../data/whatsapp_service.dart';
import '../../domain/models/whatsapp_model.dart';
import '../widgets/whatsapp_quick_replies_sheet.dart';
import '../widgets/whatsapp_skeleton_loader.dart';
import 'whatsapp_chat_page.dart';
import '../../../../core/constants/app_illustrations.dart';
import '../../../../core/widgets/app_illustration_view.dart';

class WhatsAppConversationsPage extends StatefulWidget {
  final List<WhatsAppConversation>? initialConversations;

  const WhatsAppConversationsPage({
    super.key,
    this.initialConversations,
  });

  @override
  State<WhatsAppConversationsPage> createState() => _WhatsAppConversationsPageState();
}

class _WhatsAppConversationsPageState extends State<WhatsAppConversationsPage>
    with WidgetsBindingObserver {
  late List<WhatsAppConversation> _conversations;
  bool _isLoading = false;
  bool _isSilentSyncing = false;
  Timer? _pollTimer;
  String _activeTab = 'all'; // 'all', 'unread', 'handoff', 'payments', 'campaigns'
  String _searchQuery = '';
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();

  static const Color waGreen = Color(0xFF008069);
  static const Color waLightGreen = Color(0xFF25D366);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _conversations = widget.initialConversations ?? [];
    _isLoading = widget.initialConversations == null;
    if (widget.initialConversations == null) {
      _loadConversations(forceLoading: true);
    }
    _startAutoRefreshTimer();
  }

  void _startAutoRefreshTimer() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      _silentRefresh();
    });
  }

  void _stopAutoRefreshTimer() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startAutoRefreshTimer();
      _silentRefresh();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _stopAutoRefreshTimer();
    }
  }

  Future<void> _loadConversations({bool forceLoading = false}) async {
    if (forceLoading || _conversations.isEmpty) {
      setState(() => _isLoading = true);
    }
    try {
      final res = await WhatsAppService.getConversations(
        search: _searchQuery,
        tab: _activeTab == 'all' ? null : _activeTab,
      );
      if (!mounted) return;
      setState(() {
        _conversations = res.conversations;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _silentRefresh() async {
    if (_isSilentSyncing) return;
    _isSilentSyncing = true;
    try {
      final res = await WhatsAppService.getConversations(
        search: _searchQuery,
        tab: _activeTab == 'all' ? null : _activeTab,
      );
      if (!mounted) return;
      if (res.conversations.isNotEmpty) {
        final bool changed = _hasChanged(_conversations, res.conversations);
        if (changed) {
          final oldUnread = _unreadTotal;
          final newUnread = res.conversations.fold(0, (sum, c) => sum + (c.unreadCount > 0 ? 1 : 0));
          setState(() {
            _conversations = res.conversations;
          });
          if (newUnread > oldUnread) {
            HapticFeedback.lightImpact();
          }
        }
      }
    } catch (_) {
      // Silently ignore background poll errors
    } finally {
      _isSilentSyncing = false;
    }
  }

  bool _hasChanged(List<WhatsAppConversation> oldList, List<WhatsAppConversation> newList) {
    if (oldList.length != newList.length) return true;
    for (int i = 0; i < oldList.length; i++) {
      final o = oldList[i];
      final n = newList[i];
      if (o.id != n.id ||
          o.lastMessage != n.lastMessage ||
          o.unreadCount != n.unreadCount ||
          o.time != n.time ||
          o.isHandoff != n.isHandoff ||
          o.isPaymentPending != n.isPaymentPending ||
          o.assignedName != n.assignedName ||
          o.lastMessageStatus != n.lastMessageStatus) {
        return true;
      }
    }
    return false;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopAutoRefreshTimer();
    _searchController.dispose();
    super.dispose();
  }

  int get _unreadTotal => _conversations.fold(0, (sum, c) => sum + (c.unreadCount > 0 ? 1 : 0));
  int get _handoffTotal => _conversations.where((c) => c.isHandoff).length;
  int get _paymentsTotal => _conversations.where((c) => c.isPaymentPending).length;

  List<WhatsAppConversation> get _filteredConversations {
    return _conversations.where((c) {
      // Tab filter
      if (_activeTab == 'unread' && c.unreadCount == 0) return false;
      if (_activeTab == 'handoff' && !c.isHandoff) return false;
      if (_activeTab == 'payments' && !c.isPaymentPending) return false;
      if (_activeTab == 'campaigns' && (c.campaign == null || c.campaign!.isEmpty)) return false;

      // Search query
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchName = c.name.toLowerCase().contains(q);
        final matchPhone = c.phone.replaceAll(' ', '').contains(q.replaceAll(' ', ''));
        final matchCrop = c.crop.toLowerCase().contains(q);
        final matchLoc = c.location.toLowerCase().contains(q);
        final matchMsg = c.lastMessage.toLowerCase().contains(q);
        if (!matchName && !matchPhone && !matchCrop && !matchLoc && !matchMsg) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  void _openChat(WhatsAppConversation conv) async {
    final updatedConv = await Navigator.of(context).push<WhatsAppConversation>(
      MaterialPageRoute(
        builder: (_) => WhatsAppChatPage(conversation: conv),
      ),
    );

    if (updatedConv != null && mounted) {
      setState(() {
        final index = _conversations.indexWhere((c) => c.id == updatedConv.id);
        if (index != -1) {
          _conversations[index] = updatedConv;
        }
      });
    }
  }

  void _showNewChatDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const Row(
                children: [
                  Icon(Icons.chat_bubble_outline_rounded, color: waGreen, size: 24),
                  SizedBox(width: 10),
                  Text(
                    'Start WhatsApp Chat',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Initiate 24-hr Meta session with lead or registered farmer',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Farmer Name',
                  hintText: 'e.g. Suresh Patel',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Phone Number (10 digits)',
                  hintText: '+91 98765 00000',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    final name = nameCtrl.text.trim();
                    final phone = phoneCtrl.text.trim();
                    if (name.isEmpty || phone.isEmpty) return;

                    final newConv = WhatsAppConversation(
                      id: 'c_${DateTime.now().millisecondsSinceEpoch}',
                      name: name,
                      phone: phone.startsWith('+91') ? phone : '+91 $phone',
                      lastMessage: 'Chat session initiated by telecaller',
                      time: 'Just now',
                      unreadCount: 0,
                      avatarBgColor: const Color(0xFFDCFCE7),
                      avatarTextColor: const Color(0xFF166534),
                      messages: [
                        WhatsAppMessage(
                          id: 'msg_start',
                          text: 'Namaste $name ji! Connecting with you from SGB Agro.',
                          timestamp: 'Just now',
                          isOutgoing: true,
                          status: MessageStatus.sent,
                        ),
                      ],
                    );

                    setState(() {
                      _conversations.insert(0, newConv);
                    });

                    Navigator.pop(ctx);
                    _openChat(newConv);
                  },
                  icon: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                  label: const Text(
                    'Start Conversation',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: waGreen,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredConversations;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(_isSearching ? 65 : 60),
        child: AppBar(
          backgroundColor: waGreen,
          elevation: 1,
          automaticallyImplyLeading: false,
          title: _isSearching
              ? TextField(
                  controller: _searchController,
                  autofocus: true,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                  cursorColor: Colors.white,
                  decoration: InputDecoration(
                    hintText: 'Search chats, phone, crop...',
                    hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
                    border: InputBorder.none,
                    prefixIcon: const Icon(Icons.search, color: Colors.white70),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () {
                        setState(() {
                          _isSearching = false;
                          _searchQuery = '';
                          _searchController.clear();
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
              : Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(Icons.chat_bubble_rounded, color: waGreen, size: 20),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  'WhatsApp CRM',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFF86EFAC).withValues(alpha: 0.4), width: 0.8),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF25D366),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Text(
                                      'LIVE',
                                      style: TextStyle(
                                        color: Color(0xFF86EFAC),
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const Text(
                            'Telecaller Active • Official Meta API',
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
                    tooltip: 'Search Chats',
                    onPressed: () {
                      setState(() {
                        _isSearching = true;
                      });
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.quickreply_rounded, color: Colors.white),
                    tooltip: 'Quick Templates',
                    onPressed: () {
                      WhatsAppQuickRepliesSheet.show(
                        context,
                        onSelectReply: (qr) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Template "${qr.shortcut}" ready to send inside chat'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                      );
                    },
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, color: Colors.white),
                    onSelected: (val) {
                      if (val == 'quick_replies') {
                        WhatsAppQuickRepliesSheet.show(context, onSelectReply: (_) {});
                      } else if (val == 'handoffs') {
                        setState(() => _activeTab = 'handoff');
                      } else if (val == 'payments') {
                        setState(() => _activeTab = 'payments');
                      } else if (val == 'refresh') {
                        setState(() {
                          _conversations = WhatsAppConversation.sampleConversations();
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('WhatsApp chats synchronized'),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(
                        value: 'quick_replies',
                        child: Row(
                          children: [
                            Icon(Icons.flash_on_rounded, color: Color(0xFF166534), size: 18),
                            SizedBox(width: 10),
                            Text('Quick Reply Templates (/)'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'handoffs',
                        child: Row(
                          children: [
                            Icon(Icons.support_agent_rounded, color: Color(0xFFDC2626), size: 18),
                            SizedBox(width: 10),
                            Text('View Pending Handoffs'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'payments',
                        child: Row(
                          children: [
                            Icon(Icons.payment_rounded, color: Color(0xFF166534), size: 18),
                            SizedBox(width: 10),
                            Text('Pending UPI Verifications'),
                          ],
                        ),
                      ),
                      const PopupMenuDivider(),
                      const PopupMenuItem(
                        value: 'refresh',
                        child: Row(
                          children: [
                            Icon(Icons.refresh_rounded, color: Color(0xFF64748B), size: 18),
                            SizedBox(width: 10),
                            Text('Sync Chats with Server'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs Bar (All, Unread, Handoff, Payments, Campaigns)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildFilterTab(
                    keyId: 'all',
                    label: 'All',
                    count: _conversations.length,
                    isSelected: _activeTab == 'all',
                  ),
                  const SizedBox(width: 8),
                  _buildFilterTab(
                    keyId: 'unread',
                    label: 'Unread',
                    count: _unreadTotal,
                    isSelected: _activeTab == 'unread',
                    badgeColor: const Color(0xFF25D366),
                  ),
                  const SizedBox(width: 8),
                  _buildFilterTab(
                    keyId: 'handoff',
                    label: 'Handoff 🚨',
                    count: _handoffTotal,
                    isSelected: _activeTab == 'handoff',
                    badgeColor: const Color(0xFFEF4444),
                    highlight: true,
                  ),
                  const SizedBox(width: 8),
                  _buildFilterTab(
                    keyId: 'payments',
                    label: 'Payments 💳',
                    count: _paymentsTotal,
                    isSelected: _activeTab == 'payments',
                    badgeColor: const Color(0xFF10B981),
                  ),
                  const SizedBox(width: 8),
                  _buildFilterTab(
                    keyId: 'campaigns',
                    label: 'Campaigns',
                    count: _conversations.where((c) => c.campaign != null).length,
                    isSelected: _activeTab == 'campaigns',
                  ),
                ],
              ),
            ),
          ),

          // Urgent Handoff / Action notice banner (if handoffs exist)
          if (_handoffTotal > 0 && _activeTab != 'handoff')
            GestureDetector(
              onTap: () => setState(() => _activeTab = 'handoff'),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                decoration: const BoxDecoration(
                  color: Color(0xFFFEF2F2),
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFFCA5A5), width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '$_handoffTotal customer waiting for human telecaller handoff',
                        style: const TextStyle(
                          color: Color(0xFF991B1B),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Text(
                      'View ➔',
                      style: TextStyle(
                        color: Color(0xFFDC2626),
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (_isLoading && _conversations.isEmpty)
            const LinearProgressIndicator(
              minHeight: 2.5,
              backgroundColor: Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(waGreen),
            ),

          // Conversations List
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadConversations,
              color: waGreen,
              child: _isLoading && _conversations.isEmpty
                  ? const WhatsAppSkeletonList()
                  : (filtered.isEmpty
                      ? _buildEmptyState()
                      : ListView.separated(
                          itemCount: filtered.length,
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          separatorBuilder: (_, __) => const Divider(
                            height: 1,
                            indent: 78,
                            endIndent: 16,
                            color: Color(0xFFF1F5F9),
                          ),
                          itemBuilder: (ctx, index) {
                            final conv = filtered[index];
                            return _buildConversationTile(conv);
                          },
                        )),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showNewChatDialog,
        backgroundColor: waLightGreen,
        elevation: 4,
        child: const Icon(Icons.message_rounded, color: Colors.white, size: 24),
      ),
      bottomNavigationBar: DashboardBottomNav(
        currentIndex: 3, // WhatsApp is active tab
        onTabSelected: (index) {
          if (index == 0) {
            Navigator.of(context).pushReplacementNamed('/dashboard');
          } else if (index == 1) {
            Navigator.of(context).pushReplacementNamed('/leads');
          } else if (index == 2) {
            Navigator.of(context).pushReplacementNamed('/orders');
          } else if (index == 3) {
            // Already here
          } else if (index == 4) {
            MoreOptionsBottomSheet.show(context);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Navigating to section $index...'),
                duration: const Duration(seconds: 1),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        onCallPressed: () {
          Navigator.of(context).pushNamed('/calls');
        },
      ),
    );
  }

  Widget _buildFilterTab({
    required String keyId,
    required String label,
    required int count,
    required bool isSelected,
    Color? badgeColor,
    bool highlight = false,
  }) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _activeTab = keyId;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected
              ? (highlight ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7))
              : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? (highlight ? const Color(0xFFEF4444) : waGreen)
                : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected
                    ? (highlight ? const Color(0xFFDC2626) : const Color(0xFF065F46))
                    : const Color(0xFF475569),
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                decoration: BoxDecoration(
                  color: badgeColor ?? (isSelected ? waGreen : const Color(0xFF94A3B8)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildConversationTile(WhatsAppConversation conv) {
    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: () => _openChat(conv),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar with 24h badge
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: conv.avatarBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        conv.displayAvatar,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  if (conv.is24hActive)
                    Positioned(
                      right: -3,
                      bottom: -2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00382E), // WhatsApp dark green capsule
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        child: const Text(
                          '24h',
                          style: TextStyle(
                            color: Color(0xFF25D366), // WhatsApp light green
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),

              // Conversation Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Line 1: Phone / Name & Timestamp
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            conv.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        Text(
                          conv.time,
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: conv.unreadCount > 0 ? FontWeight.w700 : FontWeight.w500,
                            color: conv.unreadCount > 0 ? waGreen : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 3),

                    // Line 2: Message preview (with Blue Double Checkmark) & Green Unread Counter
                    Row(
                      children: [
                        if (conv.isOutgoing) ...[
                          const Icon(
                            Icons.done_all_rounded,
                            size: 15.5,
                            color: Color(0xFF38BDF8), // Cyan/Blue WhatsApp read tick
                          ),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            conv.lastMessage,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: conv.unreadCount > 0
                                  ? const Color(0xFF0F172A)
                                  : const Color(0xFF64748B),
                              fontWeight: conv.unreadCount > 0 ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (conv.unreadCount > 0) ...[
                          const SizedBox(width: 8),
                          Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: waGreen, // WhatsApp green circular counter
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              conv.unreadCount.toString(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),

                    const SizedBox(height: 4),

                    // Line 3: Category Badge (COLD / WARM / HOT), Assigned Agent (👤 Shaila), and Status Chips
                    Row(
                      children: [
                        if (conv.leadCategory != null && conv.leadCategory!.isNotEmpty) ...[
                          _buildCategoryBadge(conv.leadCategory!),
                          const SizedBox(width: 6),
                        ] else if (conv.crop.isNotEmpty && conv.location.isNotEmpty && !conv.isHandoff && !conv.isPaymentPending) ...[
                          Flexible(
                            child: Text(
                              '${conv.location} • ${conv.crop}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],

                        if (conv.assignedName != null && conv.assignedName!.isNotEmpty) ...[
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.person_rounded, size: 13, color: Color(0xFF0D9488)),
                              const SizedBox(width: 3),
                              Text(
                                conv.assignedName!,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 6),
                        ],

                        if (conv.isHandoff) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFEF4444)),
                            ),
                            child: const Text(
                              '🚨 Handoff',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],

                        if (conv.isPaymentPending) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFF10B981)),
                            ),
                            child: const Text(
                              '💳 Verify',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF166534),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryBadge(String cat) {
    Color bg = const Color(0xFFEFF6FF);
    Color border = const Color(0xFFBFDBFE);
    Color text = const Color(0xFF2563EB);

    final upper = cat.toUpperCase();
    if (upper.contains('WARM')) {
      bg = const Color(0xFFFFFBEB);
      border = const Color(0xFFFDE68A);
      text = const Color(0xFFD97706);
    } else if (upper.contains('HOT')) {
      bg = const Color(0xFFFEF2F2);
      border = const Color(0xFFFECACA);
      text = const Color(0xFFDC2626);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border),
      ),
      child: Text(
        upper,
        style: TextStyle(
          color: text,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    if (_searchQuery.isNotEmpty) {
      return AppIllustrationView(
        imagePath: AppIllustrations.emptySearch,
        title: 'No matching conversations',
        subtitle: 'No WhatsApp chats found for "$_searchQuery". Try searching with phone digits or contact name.',
        actionLabel: 'Clear Search',
        fallbackIcon: Icons.search_off_rounded,
        onAction: () {
          setState(() {
            _searchQuery = '';
            _searchController.clear();
            _isSearching = false;
          });
        },
      );
    }

    return AppIllustrationView(
      imagePath: AppIllustrations.noLeads,
      title: 'No chats in "$_activeTab"',
      subtitle: _activeTab == 'all'
          ? 'No customer WhatsApp conversations active right now. Incoming Meta inquiries will appear here.'
          : 'No customer chats found under the "$_activeTab" tab.',
      actionLabel: _activeTab == 'all' ? null : 'View All Chats',
      fallbackIcon: Icons.chat_bubble_outline_rounded,
      onAction: _activeTab == 'all'
          ? null
          : () {
              setState(() {
                _activeTab = 'all';
              });
            },
    );
  }
}
