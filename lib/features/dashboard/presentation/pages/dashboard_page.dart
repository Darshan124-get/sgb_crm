import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/dashboard_service.dart';
import '../../domain/models/dashboard_data.dart';
import '../widgets/conversion_section.dart';
import '../widgets/dashboard_bottom_nav.dart';
import '../widgets/dashboard_header.dart';
import '../widgets/dashboard_skeleton_loader.dart';
import '../widgets/followup_section.dart';
import '../widgets/kpi_cards_section.dart';
import '../widgets/lead_activity_chart.dart';
import '../widgets/more_options_bottom_sheet.dart';
import '../../../../app/router/app_router.dart';
import '../../../notifications/data/notifications_storage_service.dart';
import '../../../notifications/presentation/widgets/notification_permission_dialog.dart';
import '../../../notifications/presentation/widgets/notification_modal_sheet.dart';
import '../../../../core/services/notification_service.dart';

class DashboardPage extends StatefulWidget {
  final DashboardData? initialData;

  const DashboardPage({
    super.key,
    this.initialData,
  });

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  DashboardData? _data;
  bool _isLoading = false;
  bool _isSilentSyncing = false;
  Timer? _dashboardPollTimer;
  late final AnimationController _staggerController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;

  String _selectedTimeframe = 'Today';
  String _chartFilter = 'Day';
  int _currentNavIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _data = widget.initialData;
    _isLoading = widget.initialData == null;

    _staggerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _staggerController,
      curve: Curves.easeOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _staggerController,
        curve: Curves.easeOutCubic,
      ),
    );

    _staggerController.forward();

    if (widget.initialData == null) {
      _loadDashboardData(forceLoading: true);
    }
    _startDashboardPolling();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkNotificationPermissionPrompt();
    });
  }

  Future<void> _checkNotificationPermissionPrompt() async {
    final shown = await NotificationsStorageService.hasShownPermissionPrompt();
    if (!shown && mounted) {
      await NotificationsStorageService.setPermissionPromptShown();
      if (!mounted) return;
      await NotificationPermissionDialog.show(
        context,
        onAllow: () async {
          await NotificationService.requestPermission();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Push notifications enabled for new leads & chats!'),
                backgroundColor: Color(0xFF0A5844),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
      );
    }
  }

  void _startDashboardPolling() {
    _dashboardPollTimer?.cancel();
    _dashboardPollTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      _silentRefreshDashboard();
    });
  }

  void _stopDashboardPolling() {
    _dashboardPollTimer?.cancel();
    _dashboardPollTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startDashboardPolling();
      _silentRefreshDashboard();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _stopDashboardPolling();
    }
  }

  DateTime _selectedDate = DateTime.now();

  String _formatDateParam(DateTime d) {
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _loadDashboardData({
    bool forceLoading = false,
    String? timeframe,
    DateTime? date,
  }) async {
    if (forceLoading || _data == null) {
      setState(() => _isLoading = true);
    }
    try {
      final tf = timeframe ?? _selectedTimeframe;
      final dt = date ?? _selectedDate;
      final freshData = await DashboardService.getDashboardData(
        timeframe: tf,
        date: _formatDateParam(dt),
      );
      if (!mounted) return;
      setState(() {
        _data = freshData;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _data ??= DashboardData.fromBackend();
        _isLoading = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2025),
      lastDate: DateTime(2028),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0A5844),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadDashboardData(date: picked);
    }
  }

  Future<void> _silentRefreshDashboard() async {
    if (_isSilentSyncing) return;
    _isSilentSyncing = true;
    try {
      final freshData = await DashboardService.getDashboardData(
        timeframe: _selectedTimeframe,
        date: _formatDateParam(_selectedDate),
      );
      if (!mounted) return;
      setState(() {
        _data = freshData;
      });
    } catch (_) {
      // Silently ignore background poll errors
    } finally {
      _isSilentSyncing = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopDashboardPolling();
    _staggerController.dispose();
    super.dispose();
  }

  Future<void> _handleRefresh() async {
    await _loadDashboardData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Dashboard data synchronized with CRM'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _handleQuickCall() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.phone_in_talk_rounded,
                    color: Color(0xFF0A5844),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Acefone Quick Dialer',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'One-tap calling & automatic duration tracking',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Connecting to Next Queued Lead via Acefone...'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Call Next Queued Lead (Sunil Kumar)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0A5844),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                Navigator.of(context).pushNamed(AppRouter.calls);
              },
              icon: const Icon(Icons.dialpad_rounded, size: 20),
              label: const Text('Open Keypad & Recent Call Logs (CDR)'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0A5844),
                side: const BorderSide(color: Color(0xFF0A5844)),
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F8FA),
        body: _isLoading && _data == null
            ? const DashboardSkeletonLoader()
            : RefreshIndicator(
                onRefresh: _handleRefresh,
                color: const Color(0xFF0A5844),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 820),
                      child: Column(
                        children: [
                          // 1. Forest Green Header
                          ValueListenableBuilder<int>(
                            valueListenable: NotificationsStorageService.unreadCountNotifier,
                            builder: (context, unreadCount, _) {
                              return DashboardHeader(
                                greeting: _data!.greeting,
                                agentName: _data!.agentName,
                                subtitle: _data!.subtitle,
                                dateText: _data!.dateText,
                                notificationCount: unreadCount,
                                selectedTimeframe: _selectedTimeframe,
                                onTimeframeChanged: (tf) {
                                  setState(() => _selectedTimeframe = tf);
                                  _loadDashboardData(timeframe: tf);
                                },
                                onDateTap: _pickDate,
                                onNotificationTap: () {
                                  NotificationModalSheet.show(context);
                                },
                                onProfileTap: () {
                                  Navigator.of(context).pushNamed('/profile');
                                },
                              );
                            },
                          ),

                          if (_isLoading && _data == null)
                            const LinearProgressIndicator(
                              minHeight: 2.5,
                              backgroundColor: Color(0xFFE2E8F0),
                              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A5844)),
                            ),

                          // 2. Animated Body Content
                          FadeTransition(
                            opacity: _fadeAnimation,
                            child: SlideTransition(
                              position: _slideAnimation,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16.0,
                                  vertical: 14.0,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // KPI Cards (Row 1 & Row 2)
                                    KpiCardsSection(
                                      primaryKpis: _data!.primaryKpis,
                                      secondaryKpis: _data!.secondaryKpis,
                                      onKpiTap: (kpi) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text('${kpi.label}: ${kpi.value} (${kpi.trend})'),
                                            behavior: SnackBarBehavior.floating,
                                            duration: const Duration(seconds: 1),
                                          ),
                                        );
                                      },
                                    ),

                                    const SizedBox(height: 14),

                                    // Lead Activity Trend (Multi-line Chart)
                                    LeadActivityChart(
                                      points: _data!.getActivityPointsFor(_chartFilter),
                                      activeFilter: _chartFilter,
                                      onFilterChanged: (filter) {
                                        setState(() => _chartFilter = filter);
                                      },
                                    ),

                                    const SizedBox(height: 14),

                                    // Follow-up Section (Trend Bars + Outcomes Donut)
                                    FollowupSection(
                                      trends: _data!.followUpTrends,
                                      dayTrends: _data!.dayFollowUpTrends,
                                      weekTrends: _data!.weekFollowUpTrends,
                                      monthTrends: _data!.monthFollowUpTrends,
                                      outcomes: _data!.followUpOutcomes,
                                      totalFollowUps: _data!.totalFollowUps,
                                    ),

                                    const SizedBox(height: 14),

                                    // Conversion Section (Timeline + Conversion Rate Gauge)
                                    ConversionSection(
                                      timelineItems: _data!.timelineItems,
                                      conversionRate: _data!.conversionRate,
                                      totalFollowUps: _data!.totalFollowUps,
                                      convertedFollowUps: _data!.convertedFollowUps,
                                      avgDaysToConvert: _data!.avgDaysToConvert,
                                    ),

                                    const SizedBox(height: 24),
                                  ],
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
        bottomNavigationBar: DashboardBottomNav(
          currentIndex: _currentNavIndex,
          onTabSelected: (index) {
            setState(() => _currentNavIndex = index);
            if (index == 1) {
              Navigator.of(context).pushNamed('/leads');
            } else if (index == 2) {
              Navigator.of(context).pushNamed('/orders');
            } else if (index == 3) {
              Navigator.of(context).pushNamed('/whatsapp');
            } else if (index == 4) {
              MoreOptionsBottomSheet.show(context);
            }
          },
          onCallPressed: _handleQuickCall,
        ),
      ),
    );
  }
}
