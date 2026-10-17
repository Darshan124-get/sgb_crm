import 'package:flutter/material.dart';

class KpiItem {
  final String label;
  final String value;
  final String trend;
  final bool isTrendPositive;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final bool isHot;

  const KpiItem({
    required this.label,
    required this.value,
    required this.trend,
    this.isTrendPositive = true,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    this.isHot = false,
  });
}

class ChartPoint {
  final String label;
  final double assigned;
  final double called;
  final double connected;
  final double sold;

  const ChartPoint({
    required this.label,
    required this.assigned,
    required this.called,
    required this.connected,
    required this.sold,
  });
}

class FollowUpBarData {
  final String time;
  final double created;
  final double converted;

  const FollowUpBarData({
    required this.time,
    required this.created,
    required this.converted,
  });
}

class OutcomeSegment {
  final String label;
  final int count;
  final double percentage;
  final Color color;

  const OutcomeSegment({
    required this.label,
    required this.count,
    required this.percentage,
    required this.color,
  });
}

class TimelineProgressItem {
  final String duration;
  final double percentage;
  final Color color;

  const TimelineProgressItem({
    required this.duration,
    required this.percentage,
    required this.color,
  });
}

class DashboardData {
  final String agentName;
  final String greeting;
  final String subtitle;
  final String dateText;
  final int notificationsCount;

  final List<KpiItem> primaryKpis;
  final List<KpiItem> secondaryKpis;
  final List<ChartPoint> activityPoints;
  final List<ChartPoint> dayActivityPoints;
  final List<ChartPoint> weekActivityPoints;
  final List<ChartPoint> monthActivityPoints;

  final List<FollowUpBarData> followUpTrends;
  final List<FollowUpBarData> dayFollowUpTrends;
  final List<FollowUpBarData> weekFollowUpTrends;
  final List<FollowUpBarData> monthFollowUpTrends;

  final List<OutcomeSegment> followUpOutcomes;
  final List<TimelineProgressItem> timelineItems;

  final double conversionRate;
  final int totalFollowUps;
  final int convertedFollowUps;
  final double avgDaysToConvert;

  const DashboardData({
    required this.agentName,
    required this.greeting,
    required this.subtitle,
    required this.dateText,
    required this.notificationsCount,
    required this.primaryKpis,
    required this.secondaryKpis,
    required this.activityPoints,
    this.dayActivityPoints = const [],
    this.weekActivityPoints = const [],
    this.monthActivityPoints = const [],
    required this.followUpTrends,
    this.dayFollowUpTrends = const [],
    this.weekFollowUpTrends = const [],
    this.monthFollowUpTrends = const [],
    required this.followUpOutcomes,
    required this.timelineItems,
    required this.conversionRate,
    required this.totalFollowUps,
    required this.convertedFollowUps,
    required this.avgDaysToConvert,
  });

  List<ChartPoint> getActivityPointsFor(String filter) {
    final f = filter.toLowerCase();
    if (f == 'week') return weekActivityPoints.isNotEmpty ? weekActivityPoints : activityPoints;
    if (f == 'month') return monthActivityPoints.isNotEmpty ? monthActivityPoints : activityPoints;
    return dayActivityPoints.isNotEmpty ? dayActivityPoints : activityPoints;
  }

  List<FollowUpBarData> getFollowUpTrendsFor(String filter) {
    final f = filter.toLowerCase();
    if (f == 'week') return weekFollowUpTrends.isNotEmpty ? weekFollowUpTrends : followUpTrends;
    if (f == 'month') return monthFollowUpTrends.isNotEmpty ? monthFollowUpTrends : followUpTrends;
    return dayFollowUpTrends.isNotEmpty ? dayFollowUpTrends : followUpTrends;
  }

  static String _formatGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }

  static String _formatCurrentDate([DateTime? date]) {
    final now = date ?? DateTime.now();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final dayName = days[now.weekday - 1];
    final monthName = months[now.month - 1];
    return '$dayName, ${now.day} $monthName ${now.year}';
  }

  factory DashboardData.fromBackend({
    Map<String, dynamic> stats = const {},
    Map<String, dynamic> leadStats = const {},
    String agentName = 'Telecaller',
    String timeframe = 'Today',
    String? dateStr,
  }) {
    final kpis = (stats['kpis'] as Map<String, dynamic>?) ?? {};
    final comparison = (stats['comparison'] as Map<String, dynamic>?) ?? {};
    final whatsapp = (stats['whatsapp'] as Map<String, dynamic>?) ?? {};
    final alerts = (stats['alerts'] as List<dynamic>?) ?? [];

    final totalLeads = leadStats['all']?.toString() ?? kpis['newLeads']?.toString() ?? '0';
    final openLeads = leadStats['open']?.toString() ?? kpis['activeLeads']?.toString() ?? '0';
    final followups = leadStats['followup']?.toString() ?? kpis['followupsPending']?.toString() ?? '0';
    final hotLeads = leadStats['hot']?.toString() ?? '0';
    final lostLeads = leadStats['lost']?.toString() ?? '0';

    final soldOrders = kpis['ordersReceived']?.toString() ?? '0';
    final revenueRaw = kpis['revenueMTD'] ?? 0;
    final double revenueNum = (revenueRaw is num) ? revenueRaw.toDouble() : (double.tryParse(revenueRaw.toString()) ?? 0.0);
    final revenueVal = revenueNum >= 1000 ? revenueNum.toInt().toString() : revenueNum.toStringAsFixed(0);
    final convRateVal = double.tryParse(kpis['conversionRate']?.toString() ?? '0') ?? 0.0;

    final unreadWa = whatsapp['unread']?.toString() ?? '0';
    final notificationsCount = alerts.length > 5 ? 5 : (alerts.isNotEmpty ? alerts.length : int.tryParse(unreadWa) ?? 0);

    final totalFollowUpsCount = int.tryParse(followups) ?? (int.tryParse(stats['totalFollowUps']?.toString() ?? '') ?? 0);
    final convertedCount = int.tryParse(kpis['convertedLeads']?.toString() ?? '') ?? (int.tryParse(stats['convertedFollowUps']?.toString() ?? '') ?? 0);

    DateTime? parsedDate;
    if (dateStr != null && dateStr.isNotEmpty) {
      try {
        parsedDate = DateTime.parse(dateStr);
      } catch (_) {}
    }

    // Parse Activity Trends
    List<ChartPoint> parseChartPoints(dynamic rawList) {
      if (rawList is! List) return [];
      return rawList.map((e) {
        if (e is! Map) return null;
        return ChartPoint(
          label: e['label']?.toString() ?? '',
          assigned: (e['assigned'] as num?)?.toDouble() ?? double.tryParse(e['assigned']?.toString() ?? '0') ?? 0.0,
          called: (e['called'] as num?)?.toDouble() ?? double.tryParse(e['called']?.toString() ?? '0') ?? 0.0,
          connected: (e['connected'] as num?)?.toDouble() ?? double.tryParse(e['connected']?.toString() ?? '0') ?? 0.0,
          sold: (e['sold'] as num?)?.toDouble() ?? double.tryParse(e['sold']?.toString() ?? '0') ?? 0.0,
        );
      }).whereType<ChartPoint>().toList();
    }

    final rawActivityTrend = (stats['activityTrend'] as Map<String, dynamic>?) ?? {};
    final dayActivity = parseChartPoints(rawActivityTrend['day']);
    final weekActivity = parseChartPoints(rawActivityTrend['week']);
    final monthActivity = parseChartPoints(rawActivityTrend['month']);

    final fallbackActivity = const [
      ChartPoint(label: '8 AM', assigned: 0, called: 0, connected: 0, sold: 0),
      ChartPoint(label: '10 AM', assigned: 0, called: 0, connected: 0, sold: 0),
      ChartPoint(label: '12 PM', assigned: 0, called: 0, connected: 0, sold: 0),
      ChartPoint(label: '2 PM', assigned: 0, called: 0, connected: 0, sold: 0),
      ChartPoint(label: '4 PM', assigned: 0, called: 0, connected: 0, sold: 0),
      ChartPoint(label: '6 PM', assigned: 0, called: 0, connected: 0, sold: 0),
    ];

    // Parse Follow-up Trends
    List<FollowUpBarData> parseFollowUpTrends(dynamic rawList) {
      if (rawList is! List) return [];
      return rawList.map((e) {
        if (e is! Map) return null;
        return FollowUpBarData(
          time: e['time']?.toString() ?? e['label']?.toString() ?? '',
          created: (e['created'] as num?)?.toDouble() ?? double.tryParse(e['created']?.toString() ?? '0') ?? 0.0,
          converted: (e['converted'] as num?)?.toDouble() ?? double.tryParse(e['converted']?.toString() ?? '0') ?? 0.0,
        );
      }).whereType<FollowUpBarData>().toList();
    }

    final rawFollowUpTrends = (stats['followUpTrends'] as Map<String, dynamic>?) ?? {};
    final dayFollowUps = parseFollowUpTrends(rawFollowUpTrends['day']);
    final weekFollowUps = parseFollowUpTrends(rawFollowUpTrends['week']);
    final monthFollowUps = parseFollowUpTrends(rawFollowUpTrends['month']);

    final fallbackFollowUps = const [
      FollowUpBarData(time: '8 AM', created: 0, converted: 0),
      FollowUpBarData(time: '10 AM', created: 0, converted: 0),
      FollowUpBarData(time: '12 PM', created: 0, converted: 0),
      FollowUpBarData(time: '2 PM', created: 0, converted: 0),
      FollowUpBarData(time: '4 PM', created: 0, converted: 0),
      FollowUpBarData(time: '6 PM', created: 0, converted: 0),
    ];

    // Parse Follow-up Outcomes
    List<OutcomeSegment> parseOutcomes(dynamic rawList) {
      if (rawList is! List || rawList.isEmpty) return [];
      return rawList.map((e) {
        if (e is! Map) return null;
        Color color = const Color(0xFF10B981);
        final colorHex = e['color']?.toString() ?? '';
        if (colorHex == '#F97316') {
          color = const Color(0xFFF97316);
        } else if (colorHex == '#2563EB') {
          color = const Color(0xFF2563EB);
        } else if (colorHex == '#EF4444') {
          color = const Color(0xFFEF4444);
        }

        return OutcomeSegment(
          label: e['label']?.toString() ?? '',
          count: int.tryParse(e['count']?.toString() ?? '0') ?? 0,
          percentage: (e['percentage'] as num?)?.toDouble() ?? double.tryParse(e['percentage']?.toString() ?? '0') ?? 0.0,
          color: color,
        );
      }).whereType<OutcomeSegment>().toList();
    }

    final parsedOutcomes = parseOutcomes(stats['followUpOutcomes']);
    final outcomes = parsedOutcomes.isNotEmpty ? parsedOutcomes : [
      OutcomeSegment(
        label: 'Converted',
        count: convertedCount,
        percentage: totalFollowUpsCount > 0 ? (convertedCount / totalFollowUpsCount).clamp(0.0, 1.0) : 0.40,
        color: const Color(0xFF10B981),
      ),
      OutcomeSegment(
        label: 'Pending',
        count: totalFollowUpsCount,
        percentage: 0.20,
        color: const Color(0xFFF97316),
      ),
      OutcomeSegment(
        label: 'Open',
        count: int.tryParse(openLeads) ?? 0,
        percentage: 0.40,
        color: const Color(0xFF2563EB),
      ),
      OutcomeSegment(
        label: 'Lost',
        count: int.tryParse(lostLeads) ?? 0,
        percentage: 0.0,
        color: const Color(0xFFEF4444),
      ),
    ];

    // Parse Timeline Items
    List<TimelineProgressItem> parseTimeline(dynamic rawList) {
      if (rawList is! List || rawList.isEmpty) return [];
      return rawList.map((e) {
        if (e is! Map) return null;
        Color color = const Color(0xFF0A5844);
        final colorHex = e['color']?.toString() ?? '';
        if (colorHex == '#2563EB') {
          color = const Color(0xFF2563EB);
        } else if (colorHex == '#F97316') {
          color = const Color(0xFFF97316);
        } else if (colorHex == '#EF4444') {
          color = const Color(0xFFEF4444);
        }

        return TimelineProgressItem(
          duration: e['duration']?.toString() ?? '',
          percentage: (e['percentage'] as num?)?.toDouble() ?? double.tryParse(e['percentage']?.toString() ?? '0') ?? 0.0,
          color: color,
        );
      }).whereType<TimelineProgressItem>().toList();
    }

    final parsedTimeline = parseTimeline(stats['timelineItems']);
    final timeline = parsedTimeline.isNotEmpty ? parsedTimeline : const [
      TimelineProgressItem(duration: 'Same Day', percentage: 0.50, color: Color(0xFF0A5844)),
      TimelineProgressItem(duration: '1 – 3 Days', percentage: 0.30, color: Color(0xFF2563EB)),
      TimelineProgressItem(duration: '4 – 7 Days', percentage: 0.15, color: Color(0xFFF97316)),
      TimelineProgressItem(duration: '8+ Days', percentage: 0.05, color: Color(0xFFEF4444)),
    ];

    return DashboardData(
      agentName: agentName,
      greeting: _formatGreeting(),
      subtitle: "Here's your live sales overview for $timeframe",
      dateText: _formatCurrentDate(parsedDate),
      notificationsCount: notificationsCount,
      primaryKpis: [
        KpiItem(
          label: 'Total Leads',
          value: totalLeads,
          trend: comparison['newLeads']?.toString() ?? '+0%',
          isTrendPositive: true,
          icon: Icons.people_alt_rounded,
          iconColor: const Color(0xFF2563EB),
          iconBgColor: const Color(0xFFE0E7FF),
        ),
        KpiItem(
          label: 'Active Leads',
          value: openLeads,
          trend: comparison['activeLeads']?.toString() ?? '+0%',
          isTrendPositive: true,
          icon: Icons.phone_rounded,
          iconColor: const Color(0xFF10B981),
          iconBgColor: const Color(0xFFDCFCE7),
        ),
        KpiItem(
          label: 'Follow-ups',
          value: followups,
          trend: comparison['followupsPending']?.toString() ?? '+0%',
          isTrendPositive: true,
          icon: Icons.phone_in_talk_rounded,
          iconColor: const Color(0xFF9333EA),
          iconBgColor: const Color(0xFFF3E8FF),
        ),
        KpiItem(
          label: 'Hot Leads',
          value: hotLeads,
          trend: 'Priority',
          isTrendPositive: true,
          icon: Icons.local_fire_department_rounded,
          iconColor: const Color(0xFFF97316),
          iconBgColor: const Color(0xFFFFEDD5),
          isHot: true,
        ),
      ],
      secondaryKpis: [
        KpiItem(
          label: 'Orders Booked',
          value: soldOrders,
          trend: comparison['ordersReceived']?.toString() ?? '+0%',
          isTrendPositive: true,
          icon: Icons.shopping_cart_rounded,
          iconColor: const Color(0xFF10B981),
          iconBgColor: const Color(0xFFDCFCE7),
        ),
        KpiItem(
          label: 'Revenue (MTD)',
          value: '₹$revenueVal',
          trend: comparison['revenue']?.toString() ?? '+0%',
          isTrendPositive: true,
          icon: Icons.currency_rupee_rounded,
          iconColor: const Color(0xFFE11D48),
          iconBgColor: const Color(0xFFFFE4E6),
          isHot: true,
        ),
        KpiItem(
          label: 'WhatsApp Unread',
          value: unreadWa,
          trend: '${whatsapp['replyRate'] ?? 100}% reply',
          isTrendPositive: true,
          icon: Icons.chat_rounded,
          iconColor: const Color(0xFF25D366),
          iconBgColor: const Color(0xFFDCFCE7),
        ),
        KpiItem(
          label: 'Converted Leads',
          value: convertedCount.toString(),
          trend: '${convRateVal.toStringAsFixed(1)}%',
          isTrendPositive: true,
          icon: Icons.track_changes_rounded,
          iconColor: const Color(0xFF0284C7),
          iconBgColor: const Color(0xFFE0F2FE),
        ),
        KpiItem(
          label: 'Lost Leads',
          value: lostLeads,
          trend: 'Archive',
          isTrendPositive: false,
          icon: Icons.close_rounded,
          iconColor: const Color(0xFFEF4444),
          iconBgColor: const Color(0xFFFEE2E2),
        ),
      ],
      activityPoints: dayActivity.isNotEmpty ? dayActivity : fallbackActivity,
      dayActivityPoints: dayActivity.isNotEmpty ? dayActivity : fallbackActivity,
      weekActivityPoints: weekActivity.isNotEmpty ? weekActivity : fallbackActivity,
      monthActivityPoints: monthActivity.isNotEmpty ? monthActivity : fallbackActivity,
      followUpTrends: dayFollowUps.isNotEmpty ? dayFollowUps : fallbackFollowUps,
      dayFollowUpTrends: dayFollowUps.isNotEmpty ? dayFollowUps : fallbackFollowUps,
      weekFollowUpTrends: weekFollowUps.isNotEmpty ? weekFollowUps : fallbackFollowUps,
      monthFollowUpTrends: monthFollowUps.isNotEmpty ? monthFollowUps : fallbackFollowUps,
      followUpOutcomes: outcomes,
      timelineItems: timeline,
      conversionRate: convRateVal > 0 ? (convRateVal / 100.0) : 0.45,
      totalFollowUps: totalFollowUpsCount > 0 ? totalFollowUpsCount : (stats['totalFollowUps'] != null ? int.tryParse(stats['totalFollowUps'].toString()) ?? 0 : 5),
      convertedFollowUps: convertedCount > 0 ? convertedCount : 2,
      avgDaysToConvert: 2.1,
    );
  }

  static DashboardData sample() {
    return const DashboardData(
      agentName: 'Rahul',
      greeting: 'Good Morning,',
      subtitle: "Here's your sales overview for today",
      dateText: 'Tue, 12 Sep 2024',
      notificationsCount: 3,
      primaryKpis: [
        KpiItem(
          label: 'Total Leads',
          value: '48',
          trend: '↑ 12%',
          isTrendPositive: true,
          icon: Icons.people_alt_rounded,
          iconColor: Color(0xFF2563EB),
          iconBgColor: Color(0xFFE0E7FF),
        ),
        KpiItem(
          label: 'Called',
          value: '42',
          trend: '↑ 8%',
          isTrendPositive: true,
          icon: Icons.phone_rounded,
          iconColor: Color(0xFF10B981),
          iconBgColor: Color(0xFFDCFCE7),
        ),
        KpiItem(
          label: 'Connected',
          value: '30',
          trend: '71%',
          isTrendPositive: true,
          icon: Icons.phone_in_talk_rounded,
          iconColor: Color(0xFF9333EA),
          iconBgColor: Color(0xFFF3E8FF),
        ),
        KpiItem(
          label: 'Missed',
          value: '12',
          trend: '29%',
          isTrendPositive: false,
          icon: Icons.trending_up_rounded,
          iconColor: Color(0xFFF97316),
          iconBgColor: Color(0xFFFFEDD5),
        ),
      ],
      secondaryKpis: [
        KpiItem(
          label: 'Sold Orders',
          value: '8',
          trend: '↑ 33%',
          isTrendPositive: true,
          icon: Icons.shopping_cart_rounded,
          iconColor: Color(0xFF10B981),
          iconBgColor: Color(0xFFDCFCE7),
        ),
        KpiItem(
          label: 'Sold Value',
          value: '24,500',
          trend: '↑ 26%',
          isTrendPositive: true,
          icon: Icons.currency_rupee_rounded,
          iconColor: Color(0xFFE11D48),
          iconBgColor: Color(0xFFFFE4E6),
          isHot: true,
        ),
        KpiItem(
          label: 'Units Sold',
          value: '16',
          trend: '↑ 23%',
          isTrendPositive: true,
          icon: Icons.inventory_2_rounded,
          iconColor: Color(0xFF8B5CF6),
          iconBgColor: Color(0xFFEDE9FE),
        ),
        KpiItem(
          label: 'Converted Leads',
          value: '12',
          trend: '25%',
          isTrendPositive: true,
          icon: Icons.track_changes_rounded,
          iconColor: Color(0xFF0284C7),
          iconBgColor: Color(0xFFE0F2FE),
        ),
        KpiItem(
          label: 'Lost Leads',
          value: '6',
          trend: '12%',
          isTrendPositive: false,
          icon: Icons.close_rounded,
          iconColor: Color(0xFFEF4444),
          iconBgColor: Color(0xFFFEE2E2),
        ),
      ],
      activityPoints: [
        ChartPoint(label: '8 AM', assigned: 26, called: 17, connected: 12, sold: 9),
        ChartPoint(label: '10 AM', assigned: 40, called: 32, connected: 21, sold: 11),
        ChartPoint(label: '12 PM', assigned: 62, called: 48, connected: 28, sold: 10),
        ChartPoint(label: '2 PM', assigned: 58, called: 40, connected: 22, sold: 10),
        ChartPoint(label: '4 PM', assigned: 72, called: 53, connected: 36, sold: 19),
        ChartPoint(label: '6 PM', assigned: 66, called: 48, connected: 36, sold: 19),
        ChartPoint(label: '8 PM', assigned: 53, called: 40, connected: 29, sold: 17),
      ],
      followUpTrends: [
        FollowUpBarData(time: '8 AM', created: 10, converted: 5),
        FollowUpBarData(time: '10 AM', created: 18, converted: 12),
        FollowUpBarData(time: '12 PM', created: 26, converted: 13),
        FollowUpBarData(time: '2 PM', created: 26, converted: 15),
        FollowUpBarData(time: '4 PM', created: 26, converted: 17),
        FollowUpBarData(time: '6 PM', created: 18, converted: 9),
      ],
      followUpOutcomes: [
        OutcomeSegment(
          label: 'Converted',
          count: 12,
          percentage: 0.60,
          color: Color(0xFF10B981),
        ),
        OutcomeSegment(
          label: 'Pending',
          count: 4,
          percentage: 0.20,
          color: Color(0xFFF97316),
        ),
        OutcomeSegment(
          label: 'Rescheduled',
          count: 2,
          percentage: 0.10,
          color: Color(0xFF2563EB),
        ),
        OutcomeSegment(
          label: 'Lost',
          count: 2,
          percentage: 0.10,
          color: Color(0xFFEF4444),
        ),
      ],
      timelineItems: [
        TimelineProgressItem(
          duration: 'Same Day',
          percentage: 0.40,
          color: Color(0xFF0A5844),
        ),
        TimelineProgressItem(
          duration: '1 – 3 Days',
          percentage: 0.35,
          color: Color(0xFF2563EB),
        ),
        TimelineProgressItem(
          duration: '4 – 7 Days',
          percentage: 0.15,
          color: Color(0xFFF97316),
        ),
        TimelineProgressItem(
          duration: '8+ Days',
          percentage: 0.10,
          color: Color(0xFFEF4444),
        ),
      ],
      conversionRate: 0.60,
      totalFollowUps: 20,
      convertedFollowUps: 12,
      avgDaysToConvert: 2.3,
    );
  }
}
