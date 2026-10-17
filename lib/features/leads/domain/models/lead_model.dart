import 'package:flutter/material.dart';

enum LeadStatus {
  newLead,
  followUp,
  interested,
  contacted, // Call Connected
  callback,  // Callback status (not received / call attempt)
  converted,
  lost,
}

class LeadModel {
  final String id;
  final String name;
  final String phone;
  final String city;
  final String state;
  final String time;
  final LeadStatus status;
  final bool isToday;
  final String notes;
  final String score;
  final bool isHot;
  final String priority;
  final String campaign;
  final DateTime? createdAt;
  final DateTime? assignedAt;
  final String firstMessage;
  final String leadSource;
  final String productInterest;
  final String assignedStaff;
  final String? nextFollowUp;
  final String scoreFraction;
  final String village;
  final String district;
  final String pincode;
  final String language;
  final int callCount;

  const LeadModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.city,
    required this.state,
    required this.time,
    required this.status,
    this.isToday = true,
    this.notes = '',
    this.score = 'warm',
    this.isHot = false,
    this.priority = 'Medium',
    this.campaign = 'WhatsApp Campaign',
    this.createdAt,
    this.assignedAt,
    this.firstMessage = '',
    this.leadSource = '-',
    this.productInterest = '-',
    this.assignedStaff = 'darshan_acefone_test_2',
    this.nextFollowUp,
    this.scoreFraction = '1/5',
    this.village = '',
    this.district = '',
    this.pincode = '',
    this.language = 'English',
    this.callCount = 0,
  });

  static LeadStatus parseStatus(String? status) {
    final s = (status ?? '').toLowerCase().trim();
    if (s == 'callback' || s.contains('callback')) {
      return LeadStatus.callback;
    } else if (s.contains('follow')) {
      return LeadStatus.followUp;
    } else if (s.contains('interest') || s.contains('hot')) {
      return LeadStatus.interested;
    } else if (s.contains('connect') || s.contains('contact')) {
      return LeadStatus.contacted; // Call Connected
    } else if (s.contains('convert') || s.contains('won') || s.contains('order')) {
      return LeadStatus.converted;
    } else if (s.contains('lost') || s.contains('drop') || s.contains('not') || s.contains('reject')) {
      return LeadStatus.lost;
    }
    return LeadStatus.newLead;
  }

  factory LeadModel.fromJson(Map<String, dynamic> json) {
    final name = (json['customer_name'] as String?)?.trim();
    final leadId = json['lead_id']?.toString() ?? '';
    final createdAtStr = json['created_at']?.toString();
    final assignedAtStr = json['assigned_at']?.toString();
    final updatedAtStr = json['updated_at']?.toString();

    DateTime? createdAt;
    if (createdAtStr != null) {
      createdAt = DateTime.tryParse(createdAtStr)?.toLocal();
    }
    DateTime? assignedAt;
    if (assignedAtStr != null) {
      assignedAt = DateTime.tryParse(assignedAtStr)?.toLocal();
    }
    DateTime? updatedAt;
    if (updatedAtStr != null) {
      updatedAt = DateTime.tryParse(updatedAtStr)?.toLocal();
    }

    final now = DateTime.now();
    bool isToday = false;
    if (assignedAt != null) {
      isToday = now.year == assignedAt.year &&
          now.month == assignedAt.month &&
          now.day == assignedAt.day;
    }
    if (!isToday && json['assigned_to'] != null && updatedAt != null) {
      isToday = now.year == updatedAt.year &&
          now.month == updatedAt.month &&
          now.day == updatedAt.day;
    }
    if (!isToday && createdAt != null) {
      isToday = now.year == createdAt.year &&
          now.month == createdAt.month &&
          now.day == createdAt.day;
    }

    String timeFormatted = 'Today';
    final targetDate = (isToday && assignedAt != null)
        ? assignedAt
        : ((isToday && updatedAt != null && json['assigned_to'] != null)
            ? updatedAt
            : (createdAt ?? now));

    final hour = targetDate.hour > 12 ? targetDate.hour - 12 : (targetDate.hour == 0 ? 12 : targetDate.hour);
    final amPm = targetDate.hour >= 12 ? 'PM' : 'AM';
    final min = targetDate.minute.toString().padLeft(2, '0');
    timeFormatted = '$hour:$min $amPm';

    final rawScore = json['score']?.toString().toLowerCase() ?? '';
    final rawCategory = json['lead_category']?.toString().toLowerCase() ?? '';
    final notesText = json['feedback']?.toString() ??
        json['notes']?.toString() ??
        json['first_message']?.toString() ??
        '';
    final parsedStatus = parseStatus(json['status']?.toString());
    final isHotLead = rawScore.contains('hot') ||
        rawCategory.contains('hot') ||
        notesText.toLowerCase().contains('hot') ||
        parsedStatus == LeadStatus.interested ||
        json['is_hot'] == true ||
        json['is_hot'] == 1;

    // 1. Parse Score: High, Mid, Low (Telecaller Web CRM logic)
    String score = 'Low';
    if (rawScore == 'high' || rawScore.contains('hot') || isHotLead) {
      score = 'High';
    } else if (rawScore == 'mid' || rawScore == 'medium' || rawScore.contains('warm') || rawScore.contains('mild')) {
      score = 'Mid';
    } else if (rawScore == 'low' || rawScore.contains('cold')) {
      score = 'Low';
    } else {
      // Telecaller Web logic: getScoreFromStatus(status)
      if (parsedStatus == LeadStatus.interested || parsedStatus == LeadStatus.converted) {
        score = 'High';
      } else if (parsedStatus == LeadStatus.followUp || parsedStatus == LeadStatus.contacted) {
        score = 'Mid';
      } else {
        score = 'Low';
      }
    }

    // 2. Parse Priority: 1/5, 2/5, 3/5, 4/5, 5/5 (Telecaller Web Chatbot progression steps)
    int botAns = 0;
    int botTot = 5;
    if (json['bot_answered'] != null) {
      botAns = int.tryParse(json['bot_answered'].toString()) ?? 0;
    } else if (json['bot_variables'] != null) {
      try {
        final vars = json['bot_variables'];
        if (vars is Map) {
          botAns = vars.keys.where((k) => !k.toString().startsWith('_') && k.toString() != 'first_message').length;
        }
      } catch (_) {}
    }

    String priorityFraction = '1/5';
    final rawPriority = json['priority']?.toString().trim() ?? json['bot_priority']?.toString().trim() ?? '';
    if (rawPriority.contains('/')) {
      priorityFraction = rawPriority;
    } else if (botAns > 0) {
      botTot = int.tryParse(json['bot_total']?.toString() ?? '5') ?? 5;
      priorityFraction = '$botAns/$botTot';
    } else if (rawPriority.isNotEmpty) {
      final pLower = rawPriority.toLowerCase();
      if (pLower.contains('high')) {
        priorityFraction = '5/5';
      } else if (pLower.contains('medium') || pLower.contains('mid')) {
        priorityFraction = '3/5';
      } else {
        priorityFraction = '1/5';
      }
    } else {
      priorityFraction = score == 'High' ? '5/5' : (score == 'Mid' ? '3/5' : '1/5');
    }

    // Parse Campaign Name
    final campaignRaw = json['campaign_id_code']?.toString() ??
        json['campaign_product_name']?.toString() ??
        json['campaign_name']?.toString() ??
        json['campaign']?.toString() ??
        json['source']?.toString();
    final campaignName = (campaignRaw != null && campaignRaw.isNotEmpty)
        ? campaignRaw
        : '-';

    final firstMsg = json['first_message']?.toString() ??
        json['message']?.toString() ??
        notesText;
    final leadSrc = json['source']?.toString() ??
        json['lead_source']?.toString() ??
        '-';
    final productInt = json['product_interest']?.toString() ??
        json['campaign_product_name']?.toString() ??
        json['product_name']?.toString() ??
        '-';
    final staff = json['assigned_to_name']?.toString() ??
        json['assigned_staff']?.toString() ??
        'darshan_acefone_test_2';
    final nextFup = json['next_followup_date']?.toString() ??
        json['follow_up_date']?.toString() ??
        json['next_followup']?.toString() ??
        json['next_follow_up']?.toString();

    final villageStr = json['village']?.toString() ?? json['city']?.toString() ?? '';
    final districtStr = json['district']?.toString() ?? '';
    final pincodeStr = json['pincode']?.toString() ?? '';
    final languageStr = json['language']?.toString() ?? 'English';
    final callCountNum = int.tryParse(json['call_count']?.toString() ?? '') ?? 0;

    return LeadModel(
      id: leadId,
      name: (name != null && name.isNotEmpty) ? name : 'Lead #$leadId',
      phone: json['phone_number']?.toString() ?? '',
      city: json['city']?.toString() ?? json['district']?.toString() ?? 'Rural',
      state: json['state']?.toString() ?? 'India',
      time: timeFormatted,
      status: parsedStatus,
      isToday: isToday,
      notes: notesText,
      score: score,
      isHot: isHotLead,
      priority: priorityFraction,
      campaign: campaignName,
      createdAt: createdAt,
      assignedAt: assignedAt,
      firstMessage: firstMsg,
      leadSource: leadSrc,
      productInterest: productInt,
      assignedStaff: staff,
      nextFollowUp: nextFup,
      scoreFraction: priorityFraction,
      village: villageStr,
      district: districtStr,
      pincode: pincodeStr,
      language: languageStr,
      callCount: callCountNum,
    );
  }

  // Priority Display: Always formatted as 1/5, 2/5, 3/5, 4/5, 5/5
  String get priorityDisplay {
    if (priority.contains('/')) return priority;
    final p = priority.toLowerCase().trim();
    if (p == 'high' || p == '5' || p == '4') return '5/5';
    if (p == 'medium' || p == 'mid' || p == '3') return '3/5';
    if (p == '2') return '2/5';
    if (p == 'low' || p == '1' || p == '0') return '1/5';
    return priority.isNotEmpty ? priority : '1/5';
  }

  // Priority Level: 'High', 'Medium', 'Low'
  String get priorityLevel {
    final p = priority.toLowerCase().trim();
    if (p == 'high' || p == 'medium' || p == 'low') {
      return p == 'high' ? 'High' : (p == 'medium' ? 'Medium' : 'Low');
    }
    final frac = priorityDisplay;
    if (frac.startsWith('4') || frac.startsWith('5')) return 'High';
    if (frac.startsWith('2') || frac.startsWith('3')) return 'Medium';
    return 'Low';
  }

  // Score Display: Always formatted as "High", "Mid", "Low" per Telecaller Web Logic
  String get scoreDisplay {
    final s = score.toLowerCase().trim();
    if (s == 'high' || s.contains('hot')) return 'High';
    if (s == 'mid' || s == 'medium' || s.contains('warm') || s.contains('mild')) return 'Mid';
    if (s == 'low' || s.contains('cold')) return 'Low';

    // Status-based fallback matching Telecaller Web: getScoreFromStatus(status)
    if (isHot || status == LeadStatus.interested || status == LeadStatus.converted) {
      return 'High';
    }
    if (status == LeadStatus.followUp || status == LeadStatus.contacted) {
      return 'Mid';
    }
    return 'Low';
  }

  String get createdOnFormatted {
    if (createdAt != null) {
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final d = createdAt!.day;
      final m = months[createdAt!.month - 1];
      final y = createdAt!.year;
      final hour = createdAt!.hour > 12 ? createdAt!.hour - 12 : (createdAt!.hour == 0 ? 12 : createdAt!.hour);
      final amPm = createdAt!.hour >= 12 ? 'PM' : 'AM';
      final min = createdAt!.minute.toString().padLeft(2, '0');
      return '$d $m $y, $hour:$min $amPm';
    }
    return time.isNotEmpty ? time : '20 Jul 2026, 11:22 PM';
  }

  String get nextFollowUpFormatted {
    if (nextFollowUp != null && nextFollowUp!.isNotEmpty && nextFollowUp != 'null') {
      try {
        final dt = DateTime.tryParse(nextFollowUp!);
        if (dt != null) {
          final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          final d = dt.day;
          final m = months[dt.month - 1];
          final y = dt.year;
          final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
          final amPm = dt.hour >= 12 ? 'PM' : 'AM';
          final min = dt.minute.toString().padLeft(2, '0');
          return '$d $m $y, $hour:$min $amPm';
        }
      } catch (_) {}
      return nextFollowUp!;
    }
    return '25 Jul 2026, 10:00 AM';
  }

  bool get hasFollowUp => nextFollowUp != null && nextFollowUp!.isNotEmpty && nextFollowUp != 'null';

  String? get callAttemptTag {
    if (callCount > 0) {
      final count = callCount > 3 ? 3 : callCount;
      return 'Call $count';
    }
    return null;
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase() : 'LD';
  }

  String get location => '$city, $state';

  String get statusLabel {
    switch (status) {
      case LeadStatus.newLead:
        return 'New';
      case LeadStatus.followUp:
        return 'Follow-up';
      case LeadStatus.interested:
        return 'Interested';
      case LeadStatus.contacted:
        return 'Call Connected';
      case LeadStatus.callback:
        return 'Callback';
      case LeadStatus.converted:
        return 'Converted';
      case LeadStatus.lost:
        return 'Lost';
    }
  }

  Color get statusBgColor {
    switch (status) {
      case LeadStatus.newLead:
        return const Color(0xFFDCFCE7); // Soft light green
      case LeadStatus.followUp:
        return const Color(0xFFFFEDD5); // Soft warm peach/orange
      case LeadStatus.interested:
        return const Color(0xFFF3E8FF); // Soft lilac/purple
      case LeadStatus.contacted:
        return const Color(0xFFE0F2FE); // Soft sky blue (Call Connected)
      case LeadStatus.callback:
        return const Color(0xFFFEF3C7); // Soft warm amber (Callback)
      case LeadStatus.converted:
        return const Color(0xFFD1FAE5); // Mint green
      case LeadStatus.lost:
        return const Color(0xFFFEE2E2); // Soft light red
    }
  }

  Color get statusTextColor {
    switch (status) {
      case LeadStatus.newLead:
        return const Color(0xFF166534); // Forest green
      case LeadStatus.followUp:
        return const Color(0xFFC2410C); // Deep amber/orange
      case LeadStatus.interested:
        return const Color(0xFF7E22CE); // Deep violet
      case LeadStatus.contacted:
        return const Color(0xFF0369A1); // Deep cyan/blue
      case LeadStatus.callback:
        return const Color(0xFFB45309); // Deep amber brown
      case LeadStatus.converted:
        return const Color(0xFF047857);
      case LeadStatus.lost:
        return const Color(0xFFB91C1C);
    }
  }

  Color get avatarBgColor {
    switch (name) {
      case 'Ramesh Kumar':
        return const Color(0xFFDBEAFE); // Soft blue
      case 'Priya Singh':
        return const Color(0xFFF3E8FF); // Soft purple
      case 'Amit Patel':
      case 'Sunita Devi':
      case 'Vikram Reddy':
        return const Color(0xFFDCFCE7); // Mint green
      default:
        return const Color(0xFFE2E8F0);
    }
  }

  Color get avatarTextColor {
    switch (name) {
      case 'Ramesh Kumar':
        return const Color(0xFF1E40AF); // Blue text
      case 'Priya Singh':
        return const Color(0xFF6B21A8); // Purple text
      case 'Amit Patel':
      case 'Sunita Devi':
      case 'Vikram Reddy':
        return const Color(0xFF166534); // Green text
      default:
        return const Color(0xFF334155);
    }
  }

  LeadModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? city,
    String? state,
    String? time,
    LeadStatus? status,
    bool? isToday,
    String? notes,
    String? score,
    bool? isHot,
    String? priority,
    String? campaign,
    DateTime? createdAt,
    DateTime? assignedAt,
    String? firstMessage,
    String? leadSource,
    String? productInterest,
    String? assignedStaff,
    String? nextFollowUp,
    String? scoreFraction,
    String? village,
    String? district,
    String? pincode,
    String? language,
    int? callCount,
  }) {
    return LeadModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      city: city ?? this.city,
      state: state ?? this.state,
      time: time ?? this.time,
      status: status ?? this.status,
      isToday: isToday ?? this.isToday,
      notes: notes ?? this.notes,
      score: score ?? this.score,
      isHot: isHot ?? this.isHot,
      priority: priority ?? this.priority,
      campaign: campaign ?? this.campaign,
      createdAt: createdAt ?? this.createdAt,
      assignedAt: assignedAt ?? this.assignedAt,
      firstMessage: firstMessage ?? this.firstMessage,
      leadSource: leadSource ?? this.leadSource,
      productInterest: productInterest ?? this.productInterest,
      assignedStaff: assignedStaff ?? this.assignedStaff,
      nextFollowUp: nextFollowUp ?? this.nextFollowUp,
      scoreFraction: scoreFraction ?? this.scoreFraction,
      village: village ?? this.village,
      district: district ?? this.district,
      pincode: pincode ?? this.pincode,
      language: language ?? this.language,
      callCount: callCount ?? this.callCount,
    );
  }

  static List<LeadModel> sampleLeads() {
    return [
      LeadModel(
        id: '1',
        name: 'Ramesh Kumar',
        phone: '+91 98765 43210',
        city: 'Jaipur',
        state: 'Rajasthan',
        time: '10:30 AM',
        status: LeadStatus.newLead,
        isToday: true,
        notes: 'Inquired about power tiller model 7HP. Preferred callback around 11:30 AM.',
        priority: '5/5',
        campaign: 'WhatsApp Ad 7HP',
        score: 'Mid',
        createdAt: DateTime(2026, 10, 15, 10, 30),
      ),
      LeadModel(
        id: '2',
        name: 'Priya Singh',
        phone: '+91 87654 32109',
        city: 'Ajmer',
        state: 'Rajasthan',
        time: '10:15 AM',
        status: LeadStatus.followUp,
        isToday: true,
        notes: 'Requested brochure and pricing list on WhatsApp.',
        priority: '3/5',
        campaign: 'Facebook Campaign',
        score: 'Mid',
        createdAt: DateTime(2026, 10, 15, 10, 15),
      ),
      LeadModel(
        id: '3',
        name: 'Amit Patel',
        phone: '+91 78965 43210',
        city: 'Kota',
        state: 'Rajasthan',
        time: '09:45 AM',
        status: LeadStatus.interested,
        isToday: true,
        notes: 'Needs finance options for harvester equipment.',
        priority: '5/5',
        campaign: 'Harvester Meta Flow',
        isHot: true,
        score: 'High',
        createdAt: DateTime(2026, 10, 15, 9, 45),
      ),
      LeadModel(
        id: '4',
        name: 'Sunita Devi',
        phone: '+91 98712 34567',
        city: 'Bikaner',
        state: 'Rajasthan',
        time: '09:20 AM',
        status: LeadStatus.followUp,
        isToday: true,
        notes: 'Follow-up scheduled after tractor subsidy confirmation.',
        priority: '3/5',
        campaign: 'WhatsApp Campaign',
        score: 'Mid',
        createdAt: DateTime(2026, 10, 15, 9, 20),
      ),
      LeadModel(
        id: '5',
        name: 'Vikram Reddy',
        phone: '+91 91234 56789',
        city: 'Udaipur',
        state: 'Rajasthan',
        time: '09:10 AM',
        status: LeadStatus.contacted,
        isToday: true,
        notes: 'Discussed dealership terms for southern Rajasthan belt.',
        priority: '1/5',
        campaign: 'Dealer Direct',
        score: 'Mid',
        createdAt: DateTime(2026, 10, 15, 9, 10),
      ),
      LeadModel(
        id: '6',
        name: 'Rajesh Sharma',
        phone: '+91 98221 44556',
        city: 'Jodhpur',
        state: 'Rajasthan',
        time: '08:50 AM',
        status: LeadStatus.newLead,
        isToday: false,
        notes: 'New web lead generated from WhatsApp ad campaign.',
        priority: '3/5',
        campaign: 'Website Form',
        score: 'Mid',
        createdAt: DateTime(2026, 10, 14, 8, 50),
      ),
      LeadModel(
        id: '7',
        name: 'Anjali Gupta',
        phone: '+91 97112 88990',
        city: 'Alwar',
        state: 'Rajasthan',
        time: '08:35 AM',
        status: LeadStatus.interested,
        isToday: false,
        notes: 'Looking for prompt delivery before harvesting season.',
        priority: '5/5',
        campaign: 'WhatsApp Ad 7HP',
        isHot: true,
        score: 'High',
        createdAt: DateTime(2026, 10, 14, 8, 35),
      ),
      LeadModel(
        id: '8',
        name: 'Mahesh Verma',
        phone: '+91 94140 12345',
        city: 'Sikar',
        state: 'Rajasthan',
        time: 'Yesterday',
        status: LeadStatus.lost,
        isToday: false,
        notes: 'Customer bought from local dealer. Marked as lost.',
        priority: '1/5',
        campaign: 'Facebook Campaign',
        score: 'Low',
        createdAt: DateTime(2026, 10, 13, 14, 20),
      ),
    ];
  }
}
