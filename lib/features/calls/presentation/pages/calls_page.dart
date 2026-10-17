import 'package:flutter/material.dart';
import '../../../../app/router/app_router.dart';
import '../../../../core/storage/session_storage.dart';
import '../../../dashboard/presentation/widgets/dashboard_bottom_nav.dart';
import '../../../dashboard/presentation/widgets/more_options_bottom_sheet.dart';
import '../../data/calls_service.dart';
import '../../domain/models/call_record_model.dart';
import '../widgets/call_details_bottom_sheet.dart';
import '../widgets/dialer_keypad_view.dart';
import '../../../reports/presentation/widgets/daily_telecaller_report_sheet.dart';

class CallsPage extends StatefulWidget {
  final int initialTabIndex; // 0 = Recents, 1 = Keypad

  const CallsPage({
    super.key,
    this.initialTabIndex = 0,
  });

  @override
  State<CallsPage> createState() => _CallsPageState();
}

class _CallsPageState extends State<CallsPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  List<CallRecordModel> _calls = [];
  bool _isLoading = true;
  bool _isSyncing = false;
  String _searchQuery = '';
  String _statusFilter = 'All'; // 'All', 'Connected', 'Missed'
  bool _adminShowOnlyMine = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 1),
    );
    _loadRecentCalls();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadRecentCalls({bool isRefresh = false}) async {
    if (!isRefresh) {
      setState(() => _isLoading = true);
    }
    final isAdmin = SessionStorage.currentUser?.isAdmin == true;
    final telecallerId = (isAdmin && _adminShowOnlyMine)
        ? SessionStorage.currentUser?.userId.toString()
        : null;

    final freshCalls = await CallsService.fetchRecentCalls(
      search: _searchQuery,
      telecallerId: telecallerId,
    );
    if (!mounted) return;
    setState(() {
      _calls = freshCalls;
      _isLoading = false;
    });
  }

  List<CallRecordModel> get _displayedCalls {
    if (_statusFilter == 'All') return _calls;
    if (_statusFilter == 'Connected') {
      return _calls.where((c) => c.isAnswered).toList();
    }
    if (_statusFilter == 'Missed') {
      return _calls.where((c) => c.isMissed || c.isBusy).toList();
    }
    return _calls;
  }

  Future<void> _handleSyncCdr() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            SizedBox(width: 12),
            Text('Syncing Acefone CDR records...'),
          ],
        ),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );

    final ok = await CallsService.syncAcefoneCdr();
    await _loadRecentCalls(isRefresh: true);

    if (!mounted) return;
    setState(() => _isSyncing = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Acefone CDR synced successfully' : 'Sync completed'),
        backgroundColor: const Color(0xFF059669),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query.trim();
    });
    _loadRecentCalls(isRefresh: true);
  }

  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';

    if (isToday) {
      return 'Today, $hour:$minute $ampm';
    }
    final monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${monthNames[dt.month - 1]}, $hour:$minute $ampm';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Row(
          children: [
            Icon(Icons.phone_in_talk_rounded, color: Color(0xFF0A5844), size: 24),
            SizedBox(width: 10),
            Text(
              'Calls & Dialer',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 19,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bar_chart_rounded, color: Color(0xFF0A5844)),
            tooltip: 'Daily Telecaller Report',
            onPressed: () => DailyTelecallerReportSheet.show(context),
          ),
          IconButton(
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0A5844)),
                  )
                : const Icon(Icons.sync_rounded, color: Color(0xFF0A5844)),
            tooltip: 'Sync Acefone CDR',
            onPressed: _handleSyncCdr,
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TabBar(
              controller: _tabController,
              indicatorSize: TabBarIndicatorSize.tab,
              indicator: BoxDecoration(
                color: const Color(0xFF0A5844),
                borderRadius: BorderRadius.circular(10),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: const Color(0xFF64748B),
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
              dividerColor: Colors.transparent,
              tabs: const [
                Tab(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.history_rounded, size: 17),
                      SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Recent Calls',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                Tab(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.dialpad_rounded, size: 17),
                      SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Dialer Keypad',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Recent Calls (CDR List)
          _buildRecentsTab(),

          // Tab 2: Dialer Keypad
          DialerKeypadView(
            onCallInitiated: () {
              // Switch to recents after dialing
              Future.delayed(const Duration(seconds: 1), () {
                if (mounted) {
                  _tabController.animateTo(0);
                  _loadRecentCalls(isRefresh: true);
                }
              });
            },
          ),
        ],
      ),
      bottomNavigationBar: DashboardBottomNav(
        currentIndex: -1, // Floating Calls icon is the active state
        onTabSelected: (index) {
          if (index == 0) {
            Navigator.of(context).pushReplacementNamed(AppRouter.dashboard);
          } else if (index == 1) {
            Navigator.of(context).pushReplacementNamed(AppRouter.leads);
          } else if (index == 2) {
            Navigator.of(context).pushReplacementNamed(AppRouter.orders);
          } else if (index == 3) {
            Navigator.of(context).pushReplacementNamed(AppRouter.whatsapp);
          } else if (index == 4) {
            MoreOptionsBottomSheet.show(context);
          }
        },
        onCallPressed: () {
          // Already on Calls page, switch to keypad tab
          _tabController.animateTo(1);
        },
      ),
    );
  }

  Widget _buildRecentsTab() {
    return Column(
      children: [
        // Search Bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search by phone number or lead name...',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF94A3B8)),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ),
        ),

        // Admin / Telecaller Filter & Status Chips
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (SessionStorage.currentUser?.isAdmin == true)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            if (_adminShowOnlyMine) {
                              setState(() => _adminShowOnlyMine = false);
                              _loadRecentCalls();
                            }
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(
                              color: !_adminShowOnlyMine ? const Color(0xFF0A5844) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.corporate_fare_rounded, size: 14, color: !_adminShowOnlyMine ? Colors.white : const Color(0xFF64748B)),
                                const SizedBox(width: 5),
                                Text(
                                  'All Organization',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: !_adminShowOnlyMine ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () {
                            if (!_adminShowOnlyMine) {
                              setState(() => _adminShowOnlyMine = true);
                              _loadRecentCalls();
                            }
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(
                              color: _adminShowOnlyMine ? const Color(0xFF0A5844) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_rounded, size: 14, color: _adminShowOnlyMine ? Colors.white : const Color(0xFF64748B)),
                                const SizedBox(width: 5),
                                Text(
                                  'My Calls Only',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: _adminShowOnlyMine ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_user_rounded, size: 14, color: Color(0xFF059669)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Showing only your calls (${SessionStorage.currentUser?.name.isNotEmpty == true ? SessionStorage.currentUser!.name : 'Telecaller'})',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF065F46),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),

              // Filter Chips: All, Connected, Missed
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All', _calls.length),
                    const SizedBox(width: 8),
                    _buildFilterChip('Connected', _calls.where((c) => c.isAnswered).length),
                    const SizedBox(width: 8),
                    _buildFilterChip('Missed', _calls.where((c) => c.isMissed || c.isBusy).length),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Calls List
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A5844)),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _loadRecentCalls(isRefresh: true),
                  color: const Color(0xFF0A5844),
                  child: _displayedCalls.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 60),
                            Center(
                              child: Column(
                                children: [
                                  const Icon(Icons.phone_missed_rounded, size: 48, color: Color(0xFFCBD5E1)),
                                  const SizedBox(height: 12),
                                  Text(
                                    _statusFilter == 'All' ? 'No recent calls found' : 'No $_statusFilter calls found',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _statusFilter == 'All'
                                        ? 'Pull down to refresh or sync from Acefone'
                                        : 'Try selecting a different filter above',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                  if (_statusFilter != 'All') ...[
                                    const SizedBox(height: 12),
                                    TextButton(
                                      onPressed: () => setState(() => _statusFilter = 'All'),
                                      child: const Text('Show All Calls'),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: _displayedCalls.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final call = _displayedCalls[index];
                            return _buildCallCard(call);
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, int count) {
    final isSelected = _statusFilter == label;
    return InkWell(
      onTap: () => setState(() => _statusFilter = label),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0A5844) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF0A5844) : const Color(0xFFCBD5E1),
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF0A5844).withValues(alpha: 0.2),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF475569),
              ),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.25) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                count.toString(),
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? Colors.white : const Color(0xFF64748B),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCallCard(CallRecordModel call) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => CallDetailsBottomSheet.show(context, call),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF1F5F9)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Direction Avatar
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: call.isOutbound ? const Color(0xFFDCFCE7) : const Color(0xFFE0E7FF),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  call.isOutbound ? Icons.call_made_rounded : Icons.call_received_rounded,
                  color: call.isOutbound ? const Color(0xFF047857) : const Color(0xFF4338CA),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),

              // Call Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            call.customerPhone,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (call.hasAudio) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Color(0xFFDCFCE7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.volume_up_rounded,
                              size: 11,
                              color: Color(0xFF047857),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      call.leadName != null && call.leadName!.isNotEmpty
                          ? '${call.leadName} • ${call.crmUserName ?? 'Agent'}'
                          : (call.crmUserName ?? 'Telecaller'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _formatDateTime(call.startedAt),
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF94A3B8),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (call.isAnswered && call.talkTimeSeconds > 0) ...[
                          const Text(' • ', style: TextStyle(color: Color(0xFFCBD5E1))),
                          Text(
                            call.formattedTalkTime,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Status Pill & Call Back Action
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: call.statusBgColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      call.statusLabel,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: call.statusColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () {
                      CallsService.dialCustomer(
                        context,
                        phone: call.customerPhone,
                        leadId: call.leadId,
                        leadName: call.leadName,
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0A5844).withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.phone_rounded,
                        size: 16,
                        color: Color(0xFF0A5844),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
