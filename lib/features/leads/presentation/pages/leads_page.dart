import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../dashboard/presentation/widgets/dashboard_bottom_nav.dart';
import '../../../dashboard/presentation/widgets/more_options_bottom_sheet.dart';
import '../../data/lead_service.dart';
import '../../domain/models/lead_model.dart';
import '../widgets/lead_card.dart';
import '../widgets/lead_detail_bottom_sheet.dart';
import '../widgets/lead_filter_chips.dart';
import '../widgets/lead_skeleton_loader.dart';
import '../../../whatsapp/whatsapp_navigation_helper.dart';
import '../../../../core/constants/app_illustrations.dart';
import '../../../../core/widgets/app_illustration_view.dart';
import '../../../notifications/data/notifications_storage_service.dart';
import '../../../notifications/presentation/widgets/notification_modal_sheet.dart';
import '../widgets/add_lead_bottom_sheet.dart';

class LeadsPage extends StatefulWidget {
  final List<LeadModel>? initialLeads;
  final bool? startLoading;

  const LeadsPage({
    super.key,
    this.initialLeads,
    this.startLoading,
  });

  @override
  State<LeadsPage> createState() => _LeadsPageState();
}

class _LeadsPageState extends State<LeadsPage> with WidgetsBindingObserver {
  static String _savedFilterCategory = 'All';

  late bool _isLoading;
  bool _isSilentSyncing = false;
  bool _hasNetworkError = false;
  Timer? _leadsPollTimer;
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  int _currentPage = 1;
  static const int _pageSize = 50;
  bool _hasMoreLeads = true;
  bool _isLoadingMore = false;
  int? _totalServerLeads;
  Map<String, int>? _backendStats;

  String _selectedFilter = 'All';
  List<LeadModel> _allLeads = [];
  List<LeadModel> _filteredLeads = [];
  List<String> _dynamicFilters = LeadFilterChips.defaultFilters;

  String _filterDate = 'All';
  String _filterScore = 'All';
  String _filterStatus = 'All';
  String _filterPriority = 'All';
  String _filterCampaign = 'All';

  int get _activeFilterCount {
    int count = 0;
    if (_filterDate != 'All') count++;
    if (_filterScore != 'All') count++;
    if (_filterStatus != 'All') count++;
    if (_filterPriority != 'All') count++;
    if (_filterCampaign != 'All') count++;
    return count;
  }

  List<String> get _campaignList {
    final list = _allLeads
        .map((l) => l.campaign)
        .where((c) => c.isNotEmpty)
        .toSet()
        .toList();
    if (list.isEmpty) {
      return ['WhatsApp Campaign', 'Facebook Campaign', 'Harvester Meta Flow', 'Website Form'];
    }
    list.sort();
    return list;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scrollController.addListener(_onScroll);
    _isLoading = widget.startLoading ?? (widget.initialLeads == null);
    _allLeads = widget.initialLeads ?? [];
    if (widget.initialLeads != null) {
      _selectedFilter = 'Today (32)';
      _dynamicFilters = LeadFilterChips.defaultFilters;
    } else {
      _selectedFilter = _savedFilterCategory;
      _dynamicFilters = [
        'Today ($_todayCount)',
        'New ($_newCount)',
        'All ($_allCount)',
        'Follow-up ($_followCount)',
      ];
    }
    _applyFilters();

    if (widget.startLoading == true) {
      Future.delayed(const Duration(milliseconds: 1000), () {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      });
    } else if (widget.initialLeads == null) {
      _loadLeads(forceLoading: true);
    }
    _startLeadsPolling();
  }

  void _startLeadsPolling() {
    _leadsPollTimer?.cancel();
    _leadsPollTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      _silentRefreshLeads();
    });
  }

  void _stopLeadsPolling() {
    _leadsPollTimer?.cancel();
    _leadsPollTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startLeadsPolling();
      _silentRefreshLeads();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _stopLeadsPolling();
    }
  }

  int get _todayCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.isToday).length;
    final serverCount = _backendStats?['today'];
    final localCount = _allLeads.where((l) => l.isToday).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _newCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status == LeadStatus.newLead).length;
    final serverCount = _backendStats?['new'];
    final localCount = _allLeads.where((l) => l.status == LeadStatus.newLead).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _followCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status == LeadStatus.followUp || l.hasFollowUp).length;
    final serverCount = _backendStats?['followup'];
    final localCount = _allLeads.where((l) => l.status == LeadStatus.followUp || l.hasFollowUp).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _callbackCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status == LeadStatus.callback).length;
    final serverCount = _backendStats?['callback'];
    final localCount = _allLeads.where((l) => l.status == LeadStatus.callback).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _allCount {
    if (widget.initialLeads != null) return _allLeads.length;
    final serverCount = _totalServerLeads ?? _backendStats?['all'];
    final localCount = _allLeads.length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _hotCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.isHot || l.score.toLowerCase().contains('hot') || l.status == LeadStatus.interested).length;
    final serverCount = _backendStats?['hot'];
    final localCount = _allLeads.where((l) => l.isHot || l.score.toLowerCase().contains('hot') || l.status == LeadStatus.interested).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _lostCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status == LeadStatus.lost || l.notes.toLowerCase().contains('lost')).length;
    final serverCount = _backendStats?['lost'];
    final localCount = _allLeads.where((l) => l.status == LeadStatus.lost || l.notes.toLowerCase().contains('lost')).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _openCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status != LeadStatus.lost && l.status != LeadStatus.converted).length;
    final serverCount = _backendStats?['open'];
    final localCount = _allLeads.where((l) => l.status != LeadStatus.lost && l.status != LeadStatus.converted).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  int get _convertedCount {
    if (widget.initialLeads != null) return _allLeads.where((l) => l.status == LeadStatus.converted).length;
    final serverCount = _backendStats?['converted'];
    final localCount = _allLeads.where((l) => l.status == LeadStatus.converted).length;
    return (serverCount != null && serverCount >= localCount) ? serverCount : localCount;
  }

  void _updateFilterCounts({bool preserveCategory = true}) {
    final currentPrefix = _selectedFilter.split('(').first.trim().toLowerCase();

    _dynamicFilters = [
      'Today ($_todayCount)',
      'New ($_newCount)',
      'All ($_allCount)',
      'Follow-up ($_followCount)',
    ];

    if (preserveCategory) {
      String prefix = currentPrefix;
      // UX Fix: If category is 'today' but _todayCount is 0,
      // and there are leads in the pipeline (_allCount > 0),
      // automatically switch to 'All' so the user is never stuck on an empty screen!
      if (prefix == 'today' && _todayCount == 0 && _allCount > 0) {
        prefix = 'all';
      }

      if (prefix.startsWith('hot')) {
        _selectedFilter = 'Hot Leads ($_hotCount)';
      } else if (prefix.startsWith('callback') || prefix.startsWith('call')) {
        _selectedFilter = 'Callback ($_callbackCount)';
      } else if (prefix.startsWith('lost')) {
        _selectedFilter = 'Lost Leads ($_lostCount)';
      } else if (prefix.startsWith('open')) {
        _selectedFilter = 'Open Leads ($_openCount)';
      } else if (prefix.startsWith('convert')) {
        _selectedFilter = 'Converted ($_convertedCount)';
      } else {
        final match = _dynamicFilters.firstWhere(
          (f) => f.toLowerCase().startsWith(prefix),
          orElse: () => _dynamicFilters[2], // Default to 'All'
        );
        _selectedFilter = match;
      }
      _savedFilterCategory = _selectedFilter;
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    if (currentScroll >= (maxScroll - 250)) {
      if (!_isLoadingMore && _hasMoreLeads && !_isLoading) {
        _loadMoreLeads();
      }
    }
  }

  Future<void> _loadLeads({bool forceLoading = false}) async {
    if (forceLoading || (_allLeads.isEmpty && widget.initialLeads == null)) {
      setState(() => _isLoading = true);
    }
    _currentPage = 1;
    _hasMoreLeads = true;
    try {
      final results = await Future.wait([
        LeadService.getLeadsPaginated(page: 1, limit: _pageSize),
        LeadService.getLeadStats(),
      ]);

      if (!mounted) return;

      final pagination = results[0] as LeadPaginationResult;
      final stats = results[1] as Map<String, int>;
      final mergedStats = <String, int>{...stats, ...pagination.counts};

      setState(() {
        _allLeads = pagination.leads;
        _totalServerLeads = pagination.totalLeads > 0 ? pagination.totalLeads : null;
        if (mergedStats.isNotEmpty) {
          _backendStats = mergedStats;
        }
        _hasMoreLeads = pagination.leads.length >= _pageSize &&
            (pagination.totalLeads == 0 || pagination.leads.length < pagination.totalLeads);
        _isLoading = false;
        _hasNetworkError = false;
        _updateFilterCounts(preserveCategory: _allLeads.isNotEmpty);
      });
      _applyFilters();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _hasNetworkError = true;
      });
    }
  }

  Future<void> _loadMoreLeads() async {
    if (_isLoadingMore || !_hasMoreLeads || _isLoading || widget.initialLeads != null) return;

    setState(() {
      _isLoadingMore = true;
    });

    try {
      final nextPage = _currentPage + 1;
      final result = await LeadService.getLeadsPaginated(
        page: nextPage,
        limit: _pageSize,
      );

      if (!mounted) return;

      if (result.leads.isEmpty) {
        setState(() {
          _hasMoreLeads = false;
          _isLoadingMore = false;
        });
      } else {
        setState(() {
          _currentPage = nextPage;
          final existingIds = _allLeads.map((l) => l.id).toSet();
          final newLeads = result.leads.where((l) => !existingIds.contains(l.id)).toList();
          _allLeads.addAll(newLeads);

          if (result.totalLeads > 0) {
            _totalServerLeads = result.totalLeads;
            _hasMoreLeads = _allLeads.length < result.totalLeads;
          } else {
            _hasMoreLeads = result.leads.length >= _pageSize;
          }

          if (result.counts.isNotEmpty) {
            _backendStats = {...?_backendStats, ...result.counts};
          }

          _isLoadingMore = false;
          _updateFilterCounts(preserveCategory: true);
        });
        _applyFilters();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _silentRefreshLeads() async {
    if (_isSilentSyncing || widget.initialLeads != null) return;
    _isSilentSyncing = true;
    try {
      final syncLimit = _allLeads.length > _pageSize ? _allLeads.length : _pageSize;
      final results = await Future.wait([
        LeadService.getLeadsPaginated(page: 1, limit: syncLimit),
        LeadService.getLeadStats(),
      ]);

      if (!mounted) return;

      final pagination = results[0] as LeadPaginationResult;
      final stats = results[1] as Map<String, int>;
      final leads = pagination.leads;

      final mergedStats = <String, int>{...stats, ...pagination.counts};
      if (mergedStats.isNotEmpty) {
        _backendStats = mergedStats;
      }
      if (pagination.totalLeads > 0) {
        _totalServerLeads = pagination.totalLeads;
      }

      if (leads.isNotEmpty) {
        final bool changed = _hasLeadsChanged(_allLeads, leads);
        if (changed) {
          final wasCount = _allLeads.length;
          final newCount = leads.length;

          setState(() {
            _allLeads = leads;
            _updateFilterCounts(preserveCategory: true);
          });
          _applyFilters();

          if (newCount > wasCount) {
            HapticFeedback.lightImpact();
          }
        } else {
          setState(() {
            _updateFilterCounts(preserveCategory: true);
          });
        }
      }
    } catch (_) {
      // Silently ignore background poll errors
    } finally {
      _isSilentSyncing = false;
    }
  }

  bool _hasLeadsChanged(List<LeadModel> oldList, List<LeadModel> newList) {
    if (oldList.length != newList.length) return true;
    for (int i = 0; i < oldList.length; i++) {
      final o = oldList[i];
      final n = newList[i];
      if (o.id != n.id ||
          o.status != n.status ||
          o.name != n.name ||
          o.phone != n.phone ||
          o.notes != n.notes ||
          o.isHot != n.isHot) {
        return true;
      }
    }
    return false;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _stopLeadsPolling();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openAddLeadSheet() async {
    final created = await AddLeadBottomSheet.show(context);
    if (created == true) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text(
                'Lead created successfully!',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF0A5844),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      setState(() {
        _selectedFilter = 'All';
        _savedFilterCategory = 'All';
      });
      await _loadLeads(forceLoading: true);
    }
  }


  bool _matchesAllCriteria({
    required LeadModel lead,
    required String searchQuery,
    required String selectedFilter,
    required String filterDate,
    required String filterScore,
    required String filterStatus,
    required String filterPriority,
    required String filterCampaign,
  }) {
    // 1. Text Search Filter (name, phone, city)
    final matchesQuery = searchQuery.isEmpty ||
        lead.name.toLowerCase().contains(searchQuery) ||
        lead.phone.toLowerCase().contains(searchQuery) ||
        lead.location.toLowerCase().contains(searchQuery);

    if (!matchesQuery) return false;

    // 2. Chip & More Tab Filter (Today, New, All, Follow-up, Hot, Lost, Open, Converted)
    final filter = selectedFilter.toLowerCase();
    if (filter.startsWith('today')) {
      if (!lead.isToday) return false;
    } else if (filter.startsWith('new')) {
      if (lead.status != LeadStatus.newLead) return false;
    } else if (filter.startsWith('follow-up') || filter.contains('follow')) {
      if (lead.status != LeadStatus.followUp && !lead.hasFollowUp) return false;
    } else if (filter.contains('hot')) {
      final isHot = lead.isHot ||
          lead.score.toLowerCase().contains('hot') ||
          lead.status == LeadStatus.interested;
      if (!isHot) return false;
    } else if (filter.contains('callback')) {
      if (lead.status != LeadStatus.callback) return false;
    } else if (filter.contains('lost')) {
      final isLost = lead.status == LeadStatus.lost ||
          lead.notes.toLowerCase().contains('lost');
      if (!isLost) return false;
    } else if (filter.contains('open')) {
      final isOpen = lead.status != LeadStatus.lost &&
          lead.status != LeadStatus.converted;
      if (!isOpen) return false;
    } else if (filter.contains('convert')) {
      if (lead.status != LeadStatus.converted) return false;
    }

    // 3. DATE Filter
    if (filterDate != 'All') {
      final now = DateTime.now();
      final leadDate = lead.assignedAt ?? lead.createdAt ??
          (lead.isToday ? now : now.subtract(const Duration(days: 1)));
      if (filterDate == 'Today') {
        if (!lead.isToday &&
            (leadDate.year != now.year ||
                leadDate.month != now.month ||
                leadDate.day != now.day)) {
          return false;
        }
      } else if (filterDate == 'Yesterday') {
        final yesterday = now.subtract(const Duration(days: 1));
        if (lead.isToday ||
            leadDate.year != yesterday.year ||
            leadDate.month != yesterday.month ||
            leadDate.day != yesterday.day) {
          return false;
        }
      } else if (filterDate == 'Last 7 Days') {
        if (now.difference(leadDate).inDays.abs() > 7) {
          return false;
        }
      } else if (filterDate == 'This Month') {
        if (leadDate.year != now.year || leadDate.month != now.month) {
          return false;
        }
      }
    }

    // 4. SCORE Filter (Supports High/Hot, Mid/Warm, Low/Cold)
    if (filterScore != 'All') {
      final sDisplay = lead.scoreDisplay.toLowerCase();
      final scoreLower = lead.score.toLowerCase();
      final target = filterScore.toLowerCase();
      if (target == 'hot' || target == 'high') {
        if (sDisplay != 'high' && !lead.isHot && !scoreLower.contains('hot') && !scoreLower.contains('high')) return false;
      } else if (target == 'warm' || target == 'mid' || target == 'medium') {
        if (sDisplay != 'mid' && (lead.isHot || scoreLower.contains('hot') || scoreLower.contains('cold') || lead.status == LeadStatus.lost)) {
          return false;
        }
      } else if (target == 'cold' || target == 'low') {
        if (sDisplay != 'low' && !scoreLower.contains('cold') && lead.status != LeadStatus.lost) return false;
      }
    }

    // 5. STATUS Filter
    if (filterStatus != 'All') {
      final s = filterStatus.toLowerCase();
      if (s.contains('new') && lead.status != LeadStatus.newLead) return false;
      if (s.contains('follow') && (lead.status != LeadStatus.followUp && !lead.hasFollowUp)) return false;
      if (s.contains('interest') && lead.status != LeadStatus.interested) return false;
      if (s.contains('callback') && lead.status != LeadStatus.callback) return false;
      if ((s.contains('contact') || s.contains('connect')) && lead.status != LeadStatus.contacted) return false;
      if (s.contains('convert') && lead.status != LeadStatus.converted) return false;
      if (s.contains('lost') && lead.status != LeadStatus.lost) return false;
    }

    // 6. PRIORITY Filter (Supports 1/5 to 5/5 fractions and High, Medium, Low)
    if (filterPriority != 'All') {
      final target = filterPriority.toLowerCase();
      final pLevel = lead.priorityLevel.toLowerCase();
      final pDisplay = lead.priorityDisplay.toLowerCase();
      final pRaw = lead.priority.toLowerCase();
      final matches = target == pLevel ||
          target == pDisplay ||
          target == pRaw ||
          (target == 'high' && (pDisplay.startsWith('4') || pDisplay.startsWith('5') || pLevel == 'high')) ||
          (target == 'medium' && (pDisplay.startsWith('2') || pDisplay.startsWith('3') || pLevel == 'medium')) ||
          (target == 'low' && (pDisplay.startsWith('1') || pDisplay.startsWith('0') || pLevel == 'low'));
      if (!matches) {
        return false;
      }
    }

    // 7. CAMPAIGN Filter
    if (filterCampaign != 'All') {
      if (!lead.campaign.toLowerCase().contains(filterCampaign.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  void _applyFilters() {
    final query = _searchController.text.trim().toLowerCase();

    setState(() {
      _filteredLeads = _allLeads.where((lead) {
        return _matchesAllCriteria(
          lead: lead,
          searchQuery: query,
          selectedFilter: _selectedFilter,
          filterDate: _filterDate,
          filterScore: _filterScore,
          filterStatus: _filterStatus,
          filterPriority: _filterPriority,
          filterCampaign: _filterCampaign,
        );
      }).toList();
    });
  }

  Future<void> _handleRefresh() async {
    _currentPage = 1;
    _hasMoreLeads = true;
    await _loadLeads(forceLoading: false);
  }

  void _handleLeadTap(LeadModel lead) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => LeadDetailBottomSheet(
        lead: lead,
        onCall: () {},
        onWhatsApp: () {
          WhatsAppNavigationHelper.openChatForLead(
            context,
            leadId: lead.id,
            phone: lead.phone,
            customerName: lead.name,
            city: lead.city,
            state: lead.state,
            initialNote: lead.notes,
          );
        },
        onSchedule: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Follow-up scheduler opened for ${lead.name}'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        onConverted: _handleRefresh,
        onUpdated: _handleRefresh,
      ),
    );
  }

  void _openFilterDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        final currentFilterLower = _selectedFilter.toLowerCase();
        final isHotActive = currentFilterLower.contains('hot');
        final isOpenActive = currentFilterLower.contains('open');
        final isLostActive = currentFilterLower.contains('lost');
        final isConvertedActive = currentFilterLower.contains('convert');

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top drag handle
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Title row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F4EA),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.tune_rounded,
                        size: 20,
                        color: Color(0xFF0A5844),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Pipeline Filters',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.3,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Filter leads by priority and stage',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                      splashRadius: 20,
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // 1. Hot Leads
                _buildCategoryTile(
                  icon: Icons.local_fire_department_rounded,
                  iconBgColor: const Color(0xFFFEF3C7),
                  iconColor: const Color(0xFFEA580C),
                  title: 'Hot Leads',
                  subtitle: 'High intent & interested prospects',
                  count: _hotCount,
                  isActive: isHotActive,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedFilter = 'Hot Leads ($_hotCount)';
                    });
                    _applyFilters();
                  },
                ),
                const SizedBox(height: 10),

                // 2. Open Leads
                _buildCategoryTile(
                  icon: Icons.all_inbox_rounded,
                  iconBgColor: const Color(0xFFE0F2FE),
                  iconColor: const Color(0xFF0284C7),
                  title: 'Open Leads',
                  subtitle: 'Active prospects in ongoing pipeline',
                  count: _openCount,
                  isActive: isOpenActive,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedFilter = 'Open Leads ($_openCount)';
                    });
                    _applyFilters();
                  },
                ),
                const SizedBox(height: 10),

                // 3. Lost Leads
                _buildCategoryTile(
                  icon: Icons.cancel_outlined,
                  iconBgColor: const Color(0xFFFEE2E2),
                  iconColor: const Color(0xFFDC2626),
                  title: 'Lost Leads',
                  subtitle: 'Dropped, rejected, or closed without deal',
                  count: _lostCount,
                  isActive: isLostActive,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedFilter = 'Lost Leads ($_lostCount)';
                    });
                    _applyFilters();
                  },
                ),
                const SizedBox(height: 10),

                // 4. Converted Leads
                _buildCategoryTile(
                  icon: Icons.verified_rounded,
                  iconBgColor: const Color(0xFFDCFCE7),
                  iconColor: const Color(0xFF16A34A),
                  title: 'Converted Leads',
                  subtitle: 'Successfully enrolled farmers & clients',
                  count: _convertedCount,
                  isActive: isConvertedActive,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedFilter = 'Converted ($_convertedCount)';
                    });
                    _applyFilters();
                  },
                ),
                const SizedBox(height: 10),

                // 5. Callback Leads
                _buildCategoryTile(
                  icon: Icons.phone_callback_rounded,
                  iconBgColor: const Color(0xFFFEF3C7),
                  iconColor: const Color(0xFFB45309),
                  title: 'Callback Leads',
                  subtitle: 'Unanswered calls needing 1st/2nd/3rd callback attempt',
                  count: _callbackCount,
                  isActive: _selectedFilter.toLowerCase().contains('callback'),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedFilter = 'Callback ($_callbackCount)';
                    });
                    _applyFilters();
                  },
                ),
                const SizedBox(height: 12),

                // All Filters (Date, Score, Status, Priority, Campaign) Shortcut
                Material(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      _openAdvancedFilterDialog();
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: const BoxDecoration(
                              color: Color(0xFFE6F4EA),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.tune_rounded, size: 20, color: Color(0xFF0A5844)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Filter by Date, Score & More',
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Date, Score, Status, Priority & Campaign',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_activeFilterCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0A5844),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$_activeFilterCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          const SizedBox(width: 6),
                          const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFF94A3B8)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _openAdvancedFilterDialog() {
    String tempDate = _filterDate;
    String tempScore = _filterScore;
    String tempStatus = _filterStatus;
    String tempPriority = _filterPriority;
    String tempCampaign = _filterCampaign;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final previewCount = _allLeads.where((lead) {
              return _matchesAllCriteria(
                lead: lead,
                searchQuery: _searchController.text.trim().toLowerCase(),
                selectedFilter: _selectedFilter,
                filterDate: tempDate,
                filterScore: tempScore,
                filterStatus: tempStatus,
                filterPriority: tempPriority,
                filterCampaign: tempCampaign,
              );
            }).length;

            final modalActiveCount = (tempDate != 'All' ? 1 : 0) +
                (tempScore != 'All' ? 1 : 0) +
                (tempStatus != 'All' ? 1 : 0) +
                (tempPriority != 'All' ? 1 : 0) +
                (tempCampaign != 'All' ? 1 : 0);

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.88,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag Handle
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 6),
                    child: Center(
                      child: Container(
                        width: 38,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE6F4EA),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.filter_alt_rounded,
                            size: 20,
                            color: Color(0xFF0A5844),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 8,
                                children: [
                                  const Text(
                                    'Filter Leads',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF0F172A),
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                  if (modalActiveCount > 0)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFDCFCE7),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        '$modalActiveCount active',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF166534),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Filter by date, score, status, priority & campaign',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (modalActiveCount > 0)
                          TextButton(
                            onPressed: () {
                              setModalState(() {
                                tempDate = 'All';
                                tempScore = 'All';
                                tempStatus = 'All';
                                tempPriority = 'All';
                                tempCampaign = 'All';
                              });
                            },
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFFDC2626),
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                            ),
                            child: const Text(
                              'Clear All',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                            ),
                          ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                          splashRadius: 20,
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 1, color: Color(0xFFF1F5F9)),

                  // Scrollable Sections
                  Expanded(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 1. DATE FILTER
                          _buildFilterSection(
                            icon: Icons.calendar_today_rounded,
                            title: 'DATE',
                            options: const ['All', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'],
                            selectedOption: tempDate,
                            onSelected: (opt) {
                              setModalState(() => tempDate = opt);
                            },
                          ),
                          const SizedBox(height: 20),

                          // 2. SCORE FILTER
                          _buildFilterSection(
                            icon: Icons.local_fire_department_rounded,
                            title: 'SCORE',
                            options: const ['All', 'Hot', 'Warm', 'Cold'],
                            selectedOption: tempScore,
                            onSelected: (opt) {
                              setModalState(() => tempScore = opt);
                            },
                          ),
                          const SizedBox(height: 20),

                          // 3. STATUS FILTER
                          _buildFilterSection(
                            icon: Icons.sync_alt_rounded,
                            title: 'STATUS',
                            options: const [
                              'All',
                              'New',
                              'Follow-up',
                              'Call Connected',
                              'Callback',
                              'Interested',
                              'Converted',
                              'Lost',
                            ],
                            selectedOption: tempStatus,
                            onSelected: (opt) {
                              setModalState(() => tempStatus = opt);
                            },
                          ),
                          const SizedBox(height: 20),

                          // 4. PRIORITY FILTER
                          _buildFilterSection(
                            icon: Icons.flag_rounded,
                            title: 'PRIORITY',
                            options: const ['All', 'High', 'Medium', 'Low'],
                            selectedOption: tempPriority,
                            onSelected: (opt) {
                              setModalState(() => tempPriority = opt);
                            },
                          ),
                          const SizedBox(height: 20),

                          // 5. CAMPAIGN FILTER
                          _buildFilterSection(
                            icon: Icons.campaign_rounded,
                            title: 'CAMPAIGN',
                            options: [
                              'All',
                              ..._campaignList,
                            ],
                            selectedOption: tempCampaign,
                            onSelected: (opt) {
                              setModalState(() => tempCampaign = opt);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Bottom Apply Button
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
                    ),
                    child: SafeArea(
                      top: false,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          setState(() {
                            _filterDate = tempDate;
                            _filterScore = tempScore;
                            _filterStatus = tempStatus;
                            _filterPriority = tempPriority;
                            _filterCampaign = tempCampaign;
                          });
                          _applyFilters();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0A5844),
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          modalActiveCount > 0
                              ? 'Apply Filters ($previewCount Leads)'
                              : 'Apply Filters',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFilterSection({
    required IconData icon,
    required String title,
    required List<String> options,
    required String selectedOption,
    required ValueChanged<String> onSelected,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF0A5844)),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF475569),
                letterSpacing: 0.6,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((opt) {
            final isSelected = selectedOption.toLowerCase() == opt.toLowerCase();
            return GestureDetector(
              onTap: () => onSelected(opt),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0A5844) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF0A5844) : const Color(0xFFE2E8F0),
                    width: 1.2,
                  ),
                ),
                child: Text(
                  opt,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? Colors.white : const Color(0xFF334155),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildCategoryTile({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    required int count,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return Material(
      color: isActive ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isActive ? const Color(0xFF0A5844) : const Color(0xFFE2E8F0),
              width: isActive ? 1.6 : 1.0,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: isActive ? const Color(0xFF0A5844) : const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFF0A5844) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: isActive ? Colors.white : const Color(0xFF334155),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: isActive ? const Color(0xFF0A5844) : const Color(0xFF94A3B8),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          bottom: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 820),
              child: Column(
                children: [
                  // 1. App Bar Header: Back Arrow + "Leads" + Notification Bell
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Back Arrow Button
                        IconButton(
                          onPressed: () {
                            if (Navigator.canPop(context)) {
                              Navigator.pop(context);
                            } else {
                              Navigator.of(context).pushReplacementNamed('/dashboard');
                            }
                          },
                          icon: const Icon(
                            Icons.arrow_back_ios_new_rounded,
                            size: 20,
                            color: Color(0xFF0F172A),
                          ),
                          splashRadius: 22,
                        ),

                        // Title: Leads + LIVE badge
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Leads',
                              style: TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFF86EFAC), width: 0.8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF16A34A),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text(
                                    'LIVE',
                                    style: TextStyle(
                                      color: Color(0xFF166534),
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Add Lead Button
                            IconButton(
                              onPressed: _openAddLeadSheet,
                              icon: Container(
                                padding: const EdgeInsets.all(5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0A5844).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.person_add_alt_1_rounded,
                                  size: 19,
                                  color: Color(0xFF0A5844),
                                ),
                              ),
                              tooltip: 'Add Lead',
                              splashRadius: 22,
                            ),

                            // Notification Bell with dynamic unread badge and Pop-up Sheet
                            ValueListenableBuilder<int>(
                              valueListenable: NotificationsStorageService.unreadCountNotifier,
                              builder: (context, unreadCount, _) {
                                return IconButton(
                                  onPressed: () {
                                    NotificationModalSheet.show(context);
                                  },
                                  icon: Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      const Icon(
                                        Icons.notifications_none_rounded,
                                        size: 24,
                                        color: Color(0xFF334155),
                                      ),
                                      if (unreadCount > 0)
                                        Positioned(
                                          right: -2,
                                          top: -2,
                                          child: Container(
                                            padding: const EdgeInsets.all(3),
                                            decoration: const BoxDecoration(
                                              color: Color(0xFFEF4444),
                                              shape: BoxShape.circle,
                                            ),
                                            constraints: const BoxConstraints(
                                              minWidth: 15,
                                              minHeight: 15,
                                            ),
                                            child: Text(
                                              '$unreadCount',
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 9,
                                                fontWeight: FontWeight.w800,
                                                height: 1,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  splashRadius: 22,
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 4),

                  // 2. Horizontally Scrollable Filter Chips
                  LeadFilterChips(
                    selectedFilter: _selectedFilter,
                    dynamicFilters: _dynamicFilters,
                    onFilterSelected: (filter) {
                      setState(() {
                        _selectedFilter = filter;
                        _savedFilterCategory = filter;
                      });
                      _applyFilters();
                    },
                    onMoreTap: _openFilterDialog,
                  ),

                  const SizedBox(height: 12),

                  // 3. Search Bar + Filter Action Button
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Row(
                      children: [
                        // Search Box
                        Expanded(
                          child: Container(
                            height: 46,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                                width: 1.2,
                              ),
                            ),
                            child: TextField(
                              controller: _searchController,
                              onChanged: (_) => _applyFilters(),
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'Search by name or number...',
                                hintStyle: TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w400,
                                ),
                                prefixIcon: Icon(
                                  Icons.search_rounded,
                                  color: Color(0xFF64748B),
                                  size: 20,
                                ),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 10),

                        // Filter Funnel Button
                        Material(
                          color: _activeFilterCount > 0
                              ? const Color(0xFFDCFCE7)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          child: InkWell(
                            onTap: _openAdvancedFilterDialog,
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: _activeFilterCount > 0
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFFE2E8F0),
                                  width: 1.2,
                                ),
                              ),
                              child: Center(
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Icon(
                                      Icons.filter_alt_rounded,
                                      color: _activeFilterCount > 0
                                          ? const Color(0xFF166534)
                                          : const Color(0xFF334155),
                                      size: 20,
                                    ),
                                    if (_activeFilterCount > 0)
                                      Positioned(
                                        right: -6,
                                        top: -6,
                                        child: Container(
                                          padding: const EdgeInsets.all(3.5),
                                          decoration: const BoxDecoration(
                                            color: Color(0xFF16A34A),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Text(
                                            '$_activeFilterCount',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 10),

                  // 4. Main Leads List or Skeleton Loading State
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: _handleRefresh,
                      color: const Color(0xFF0A5844),
                      child: (_isLoading && (_allLeads.isEmpty || widget.startLoading == true))
                          ? const SingleChildScrollView(
                              physics: AlwaysScrollableScrollPhysics(),
                              child: LeadSkeletonList(count: 6),
                            )
                          : _filteredLeads.isEmpty
                              ? _buildEmptyState()
                              : ListView.builder(
                                  controller: _scrollController,
                                  physics: const BouncingScrollPhysics(
                                    parent: AlwaysScrollableScrollPhysics(),
                                  ),
                                  padding: const EdgeInsets.only(top: 4, bottom: 20),
                                  itemCount: _filteredLeads.length + (_isLoadingMore ? 1 : 0),
                                  itemBuilder: (context, index) {
                                    if (index == _filteredLeads.length) {
                                      return const Padding(
                                        padding: EdgeInsets.symmetric(vertical: 20),
                                        child: Center(
                                          child: SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color: Color(0xFF0A5844),
                                            ),
                                          ),
                                        ),
                                      );
                                    }
                                    final lead = _filteredLeads[index];
                                    return LeadCard(
                                      lead: lead,
                                      onTap: () => _handleLeadTap(lead),
                                    );
                                  },
                                ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _openAddLeadSheet,
          backgroundColor: const Color(0xFF0A5844),
          foregroundColor: Colors.white,
          elevation: 4,
          icon: const Icon(Icons.person_add_rounded, size: 20),
          label: const Text(
            'Add Lead',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ),
        bottomNavigationBar: DashboardBottomNav(
          currentIndex: 1, // Leads active tab
          onTabSelected: (index) {
            if (index == 0) {
              Navigator.of(context).pushReplacementNamed('/dashboard');
            } else if (index == 1) {
              // already on Leads
            } else if (index == 2) {
              Navigator.of(context).pushNamed('/orders');
            } else if (index == 3) {
              Navigator.of(context).pushNamed('/whatsapp');
            } else if (index == 4) {
              MoreOptionsBottomSheet.show(context);
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Navigating to tab $index...'),
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
      ),
    );
  }

  Widget _buildEmptyState() {
    if (_hasNetworkError && _allLeads.isEmpty) {
      return AppIllustrationView(
        imagePath: AppIllustrations.internetConnection,
        title: 'No Internet Connection',
        subtitle: 'Unable to connect to SGB Agro servers. Please check your network and try again.',
        actionLabel: 'Retry Connection',
        fallbackIcon: Icons.wifi_off_rounded,
        onAction: () => _loadLeads(forceLoading: true),
      );
    }

    if (_searchController.text.trim().isNotEmpty) {
      return AppIllustrationView(
        imagePath: AppIllustrations.emptySearch,
        title: 'No matching leads',
        subtitle: 'No results found for "${_searchController.text.trim()}". Try searching by a different name or 10-digit number.',
        actionLabel: 'Clear Search',
        fallbackIcon: Icons.search_off_rounded,
        onAction: () {
          setState(() {
            _searchController.clear();
          });
          _applyFilters();
        },
      );
    }

    final lowerFilter = _selectedFilter.toLowerCase();
    if (lowerFilter.contains('follow')) {
      return AppIllustrationView(
        imagePath: AppIllustrations.noFollowUps,
        title: 'No follow-ups scheduled',
        subtitle: 'You have cleared all pending follow-up reminders. New follow-ups will appear when scheduled.',
        actionLabel: 'View All Leads',
        fallbackIcon: Icons.event_available_rounded,
        onAction: () {
          setState(() {
            _selectedFilter = 'All';
            _savedFilterCategory = 'All';
          });
          _applyFilters();
        },
      );
    }

    if (_allLeads.isEmpty) {
      return Center(
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: Color(0xFFE8F5E9),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(
                    Icons.people_outline_rounded,
                    size: 38,
                    color: Color(0xFF0A5844),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'No leads in pipeline',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: const Text(
                  'Your lead pipeline is currently empty. Start by adding a lead manually or sync from WhatsApp & Meta campaigns.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _openAddLeadSheet,
                icon: const Icon(Icons.person_add_rounded, size: 18),
                label: const Text('Add Lead Manually'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A5844),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Filtered empty state (e.g. "Today (0)") when other leads exist in pipeline
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(
                  Icons.filter_list_off_rounded,
                  size: 34,
                  color: Color(0xFF64748B),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'No leads in "$_selectedFilter"',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 300),
              child: Text(
                'There are ${_allLeads.length} active leads under "All". Switch filters or add a new lead.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _selectedFilter = 'All ($_allCount)';
                  _savedFilterCategory = _selectedFilter;
                  _searchController.clear();
                });
                _applyFilters();
              },
              icon: const Icon(Icons.people_outline_rounded, size: 18),
              label: Text('View All Leads (${_allLeads.length})'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0A5844),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _openAddLeadSheet,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add Lead Manually'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0A5844),
                side: const BorderSide(color: Color(0xFF0A5844), width: 1.2),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
