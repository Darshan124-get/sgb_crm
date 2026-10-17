class PendingLeadItem {
  final String leadId;
  final String customerName;
  final String phoneNumber;
  final String? district;
  final String? currentCrop;
  final String status;
  final String type; // 'Today' or 'Carryover'

  const PendingLeadItem({
    required this.leadId,
    required this.customerName,
    required this.phoneNumber,
    this.district,
    this.currentCrop,
    required this.status,
    required this.type,
  });

  factory PendingLeadItem.fromJson(Map<String, dynamic> json, {String defaultType = 'Today'}) {
    return PendingLeadItem(
      leadId: json['lead_id']?.toString() ?? '',
      customerName: json['customer_name']?.toString() ?? 'Customer',
      phoneNumber: json['phone_number']?.toString() ?? '--',
      district: json['district']?.toString() ?? json['city']?.toString(),
      currentCrop: json['current_crop']?.toString(),
      status: json['status']?.toString() ?? 'new',
      type: json['type']?.toString() ?? defaultType,
    );
  }
}

class TelecallerDailyReportModel {
  final String date;
  final String telecallerName;
  final String employeeId;
  final int assignedToday;
  final int callsMadeToday;
  final int connectedCalls;
  final String connectedPct;
  final int missedCalls;
  final String missedPct;
  final int followupsScheduled;
  final int convertedOrders;
  final double convertedOrdersValue;
  final String convertedOrdersFormatted;
  final int avgCallDurationSeconds;
  final String avgCallDurationFormatted;
  final int pendingLeadsToday;
  final int carryoverPendingYesterday;
  final List<PendingLeadItem> pendingLeadsSample;

  const TelecallerDailyReportModel({
    required this.date,
    required this.telecallerName,
    required this.employeeId,
    required this.assignedToday,
    required this.callsMadeToday,
    required this.connectedCalls,
    required this.connectedPct,
    required this.missedCalls,
    required this.missedPct,
    required this.followupsScheduled,
    required this.convertedOrders,
    required this.convertedOrdersValue,
    required this.convertedOrdersFormatted,
    required this.avgCallDurationSeconds,
    required this.avgCallDurationFormatted,
    required this.pendingLeadsToday,
    required this.carryoverPendingYesterday,
    this.pendingLeadsSample = const [],
  });

  factory TelecallerDailyReportModel.fromJson(Map<String, dynamic> json) {
    final telecaller = (json['telecaller'] as Map<String, dynamic>?) ?? {};
    final metrics = (json['metrics'] as Map<String, dynamic>?) ?? {};

    int parseInt(dynamic v) => (v is int) ? v : (int.tryParse(v?.toString() ?? '') ?? 0);
    double parseDouble(dynamic v) => (v is num) ? v.toDouble() : (double.tryParse(v?.toString() ?? '') ?? 0.0);

    final pendingTodayRaw = (json['pending_leads_today_sample'] as List?) ?? [];
    final carryoverRaw = (json['carryover_pending_sample'] as List?) ?? [];

    final list = <PendingLeadItem>[
      ...pendingTodayRaw.whereType<Map<String, dynamic>>().map((e) => PendingLeadItem.fromJson(e, defaultType: 'Today')),
      ...carryoverRaw.whereType<Map<String, dynamic>>().map((e) => PendingLeadItem.fromJson(e, defaultType: 'Carryover')),
    ];

    return TelecallerDailyReportModel(
      date: json['date']?.toString() ?? DateTime.now().toIso8601String().split('T')[0],
      telecallerName: telecaller['name']?.toString() ?? 'Telecaller',
      employeeId: telecaller['employee_id']?.toString() ?? 'N/A',
      assignedToday: parseInt(metrics['assigned_today']),
      callsMadeToday: parseInt(metrics['calls_made_today']),
      connectedCalls: parseInt(metrics['connected_calls']),
      connectedPct: metrics['connected_pct']?.toString() ?? '0.0%',
      missedCalls: parseInt(metrics['missed_calls']),
      missedPct: metrics['missed_pct']?.toString() ?? '0.0%',
      followupsScheduled: parseInt(metrics['followups_scheduled']),
      convertedOrders: parseInt(metrics['converted_orders']),
      convertedOrdersValue: parseDouble(metrics['converted_orders_value']),
      convertedOrdersFormatted: metrics['converted_orders_formatted']?.toString() ?? '0 Orders (₹0)',
      avgCallDurationSeconds: parseInt(metrics['avg_call_duration_seconds']),
      avgCallDurationFormatted: metrics['avg_call_duration_formatted']?.toString() ?? '0m 00s',
      pendingLeadsToday: parseInt(metrics['pending_leads_today']),
      carryoverPendingYesterday: parseInt(metrics['carryover_pending_yesterday']),
      pendingLeadsSample: list,
    );
  }

  static TelecallerDailyReportModel sample() {
    return const TelecallerDailyReportModel(
      date: 'Today',
      telecallerName: 'Darshan A B',
      employeeId: 'EMP-1001',
      assignedToday: 42,
      callsMadeToday: 38,
      connectedCalls: 28,
      connectedPct: '73.7%',
      missedCalls: 10,
      missedPct: '26.3%',
      followupsScheduled: 14,
      convertedOrders: 8,
      convertedOrdersValue: 24500,
      convertedOrdersFormatted: '8 Orders (₹24,500)',
      avgCallDurationSeconds: 222,
      avgCallDurationFormatted: '3m 42s',
      pendingLeadsToday: 4,
      carryoverPendingYesterday: 28,
      pendingLeadsSample: [
        PendingLeadItem(
          leadId: '50471',
          customerName: 'Suresh Patil',
          phoneNumber: '+919902018031',
          district: 'Belagavi',
          currentCrop: 'Sugarcane',
          status: 'new',
          type: 'Today',
        ),
        PendingLeadItem(
          leadId: '49418',
          customerName: 'Ramesh Gowda',
          phoneNumber: '+919876543210',
          district: 'Mandya',
          currentCrop: 'Paddy',
          status: 'assigned',
          type: 'Carryover',
        ),
      ],
    );
  }
}
