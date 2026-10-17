import 'package:flutter/material.dart';
import 'lead_model.dart';

enum CallType {
  outgoing,
  incoming,
  missed,
}

enum CallStatus {
  connected,
  noAnswer,
  notReachable,
  busy,
}

class CallLogItem {
  final String id;
  final CallType type;
  final CallStatus status;
  final String timeText;
  final String duration;
  final bool hasAudio;
  final List<double> waveformPoints;

  const CallLogItem({
    required this.id,
    required this.type,
    required this.status,
    required this.timeText,
    required this.duration,
    this.hasAudio = false,
    this.waveformPoints = const [],
  });

  String get typeLabel {
    switch (type) {
      case CallType.outgoing:
        return 'Outgoing Call';
      case CallType.incoming:
        return 'Incoming Call';
      case CallType.missed:
        return 'Missed Call';
    }
  }

  String get statusSubtitle {
    switch (status) {
      case CallStatus.connected:
        return 'Connected • $duration';
      case CallStatus.noAnswer:
        return 'No Answer';
      case CallStatus.notReachable:
        return 'Not Reachable';
      case CallStatus.busy:
        return 'Line Busy';
    }
  }

  Color get iconColor {
    switch (status) {
      case CallStatus.connected:
        return const Color(0xFF16A34A); // Green
      case CallStatus.noAnswer:
        return const Color(0xFFEA580C); // Warm Orange
      case CallStatus.notReachable:
        return const Color(0xFF9333EA); // Purple
      case CallStatus.busy:
        return const Color(0xFFDC2626); // Red
    }
  }

  Color get iconBgColor {
    switch (status) {
      case CallStatus.connected:
        return const Color(0xFFDCFCE7);
      case CallStatus.noAnswer:
        return const Color(0xFFFFEDD5);
      case CallStatus.notReachable:
        return const Color(0xFFF3E8FF);
      case CallStatus.busy:
        return const Color(0xFFFEE2E2);
    }
  }

  IconData get iconData {
    switch (type) {
      case CallType.outgoing:
        return Icons.phone_forwarded_rounded;
      case CallType.incoming:
        return Icons.phone_callback_rounded;
      case CallType.missed:
        return Icons.phone_missed_rounded;
    }
  }
}

enum TimelineEventType {
  leadCreated,
  assignedToAgent,
  callConnected,
  noteAdded,
  followupScheduled,
  whatsappSent,
  statusUpdated,
}

class TimelineItem {
  final String id;
  final String title;
  final String description;
  final String time;
  final TimelineEventType type;
  final bool hasAudioPlay;
  final String? duration;

  const TimelineItem({
    required this.id,
    required this.title,
    required this.description,
    required this.time,
    required this.type,
    this.hasAudioPlay = false,
    this.duration,
  });

  Color get nodeColor {
    switch (type) {
      case TimelineEventType.leadCreated:
        return const Color(0xFF16A34A);
      case TimelineEventType.assignedToAgent:
        return const Color(0xFF2563EB);
      case TimelineEventType.callConnected:
        return const Color(0xFF16A34A);
      case TimelineEventType.noteAdded:
        return const Color(0xFFEAB308);
      case TimelineEventType.followupScheduled:
        return const Color(0xFF9333EA);
      case TimelineEventType.whatsappSent:
        return const Color(0xFF16A34A);
      case TimelineEventType.statusUpdated:
        return const Color(0xFF3B82F6);
    }
  }

  Color get nodeBgColor {
    switch (type) {
      case TimelineEventType.leadCreated:
        return const Color(0xFFDCFCE7);
      case TimelineEventType.assignedToAgent:
        return const Color(0xFFDBEAFE);
      case TimelineEventType.callConnected:
        return const Color(0xFFDCFCE7);
      case TimelineEventType.noteAdded:
        return const Color(0xFFFEF9C3);
      case TimelineEventType.followupScheduled:
        return const Color(0xFFF3E8FF);
      case TimelineEventType.whatsappSent:
        return const Color(0xFFDCFCE7);
      case TimelineEventType.statusUpdated:
        return const Color(0xFFDBEAFE);
    }
  }

  IconData get iconData {
    switch (type) {
      case TimelineEventType.leadCreated:
        return Icons.add_circle_outline_rounded;
      case TimelineEventType.assignedToAgent:
        return Icons.person_outline_rounded;
      case TimelineEventType.callConnected:
        return Icons.phone_outlined;
      case TimelineEventType.noteAdded:
        return Icons.description_outlined;
      case TimelineEventType.followupScheduled:
        return Icons.calendar_month_outlined;
      case TimelineEventType.whatsappSent:
        return Icons.chat_bubble_outline_rounded;
      case TimelineEventType.statusUpdated:
        return Icons.bar_chart_rounded;
    }
  }
}

class PurchaseItem {
  final String orderId;
  final String orderDate;
  final String productName;
  final int units;
  final int price;
  final String status;
  final String imageAsset;

  const PurchaseItem({
    required this.orderId,
    required this.orderDate,
    required this.productName,
    required this.units,
    required this.price,
    required this.status,
    required this.imageAsset,
  });

  String get formattedPrice => '₹${price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}';
}

class PurchaseSummary {
  final int totalOrders;
  final int totalValue;
  final int totalUnits;
  final String lastOrderDate;

  const PurchaseSummary({
    required this.totalOrders,
    required this.totalValue,
    required this.totalUnits,
    required this.lastOrderDate,
  });

  String get formattedTotalValue => '₹${totalValue.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}';
}

class LeadDetailModel {
  final LeadModel lead;
  final String campaign;
  final String language;
  final String assignedTo;
  final String assignedToAvatar;
  final String createdOn;
  final String lastContact;
  final List<String> tags;
  final String source;
  final String productInterest;
  final List<CallLogItem> calls;
  final List<TimelineItem> timeline;
  final PurchaseSummary purchaseSummary;
  final List<PurchaseItem> purchases;

  // Agricultural & Field Information
  final String farmSize;
  final String primaryCrops;
  final String soilType;
  final String irrigation;
  final bool kycVerified;

  const LeadDetailModel({
    required this.lead,
    required this.campaign,
    required this.language,
    required this.assignedTo,
    required this.assignedToAvatar,
    required this.createdOn,
    required this.lastContact,
    required this.tags,
    required this.source,
    required this.productInterest,
    required this.calls,
    required this.timeline,
    required this.purchaseSummary,
    required this.purchases,
    this.farmSize = '12 Acres',
    this.primaryCrops = 'Wheat, Mustard & Groundnut',
    this.soilType = 'Loamy Alluvial Soil',
    this.irrigation = 'Tubewell & Drip System',
    this.kycVerified = true,
  });

  factory LeadDetailModel.fromBackend(Map<String, dynamic> json) {
    final lead = LeadModel.fromJson(json);

    // Parse order history into purchases
    List<dynamic> rawOrders = [];
    if (json['order_history'] is List && (json['order_history'] as List).isNotEmpty) {
      rawOrders = json['order_history'] as List<dynamic>;
    } else if (json['orders'] is List && (json['orders'] as List).isNotEmpty) {
      rawOrders = json['orders'] as List<dynamic>;
    } else if (json['order'] is Map<String, dynamic>) {
      rawOrders = [json['order']];
    } else if (json['order'] is List && (json['order'] as List).isNotEmpty) {
      rawOrders = json['order'] as List<dynamic>;
    }

    final List<PurchaseItem> purchases = [];
    int totalUnits = 0;
    int totalValue = 0;
    String lastOrderDate = 'None';

    for (final o in rawOrders) {
      if (o is Map<String, dynamic>) {
        final orderId = o['order_id']?.toString() ?? 'ORD';
        final rawDate = o['created_at']?.toString() ?? '';
        String orderDate = 'Recent';
        if (rawDate.isNotEmpty) {
          try {
            final dt = DateTime.parse(rawDate);
            final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            orderDate = '${dt.day} ${months[dt.month - 1]} ${dt.year}';
          } catch (_) {
            orderDate = rawDate.split('T').first;
          }
        }
        if (lastOrderDate == 'None') {
          lastOrderDate = orderDate;
        }

        final amount = (double.tryParse(o['total_amount']?.toString() ?? '0') ?? 0).toInt();
        final units = int.tryParse(o['total_units']?.toString() ?? '1') ?? 1;
        totalValue += amount;
        totalUnits += units;

        final rawStatus = o['order_status']?.toString() ?? 'Draft';
        final statusFormatted = rawStatus.isEmpty
            ? 'Draft'
            : rawStatus[0].toUpperCase() + rawStatus.substring(1).toLowerCase();

        final itemsText = o['items_summary']?.toString();
        final productName = (itemsText != null && itemsText.trim().isNotEmpty)
            ? itemsText.trim()
            : 'SGB Agri Equipment';

        purchases.add(
          PurchaseItem(
            orderId: '#$orderId',
            orderDate: orderDate,
            productName: productName,
            units: units,
            price: amount,
            status: statusFormatted,
            imageAsset: 'assets/images/fertilizer_bag.jpg',
          ),
        );
      }
    }

    final purchaseSummary = PurchaseSummary(
      totalOrders: purchases.length,
      totalValue: totalValue,
      totalUnits: totalUnits,
      lastOrderDate: lastOrderDate,
    );

    // Parse notes_history into timeline
    final rawNotes = (json['notes_history'] as List<dynamic>?) ?? [];
    final List<TimelineItem> timeline = [];
    final List<CallLogItem> calls = [];

    int callIdx = 0;
    for (int i = 0; i < rawNotes.length; i++) {
      final n = rawNotes[i];
      if (n is Map<String, dynamic>) {
        final noteText = n['note']?.toString() ?? '';
        final author = n['author_name']?.toString() ?? 'Agent';
        final timeStr = n['created_at'] != null ? n['created_at'].toString().split('T').first : 'Recent';

        TimelineEventType type = TimelineEventType.noteAdded;
        if (noteText.toLowerCase().contains('call')) {
          type = TimelineEventType.callConnected;
          callIdx++;
          calls.add(
            CallLogItem(
              id: 'call_$callIdx',
              type: noteText.toLowerCase().contains('not received') ? CallType.missed : CallType.outgoing,
              status: noteText.toLowerCase().contains('not received') ? CallStatus.noAnswer : CallStatus.connected,
              timeText: timeStr,
              duration: '02:15',
            ),
          );
        } else if (noteText.toLowerCase().contains('assigned')) {
          type = TimelineEventType.assignedToAgent;
        } else if (noteText.toLowerCase().contains('converted') || noteText.toLowerCase().contains('status')) {
          type = TimelineEventType.statusUpdated;
        } else if (noteText.toLowerCase().contains('follow')) {
          type = TimelineEventType.followupScheduled;
        }

        timeline.add(
          TimelineItem(
            id: 'note_${n['note_id'] ?? i}',
            title: author,
            description: noteText,
            time: timeStr,
            type: type,
          ),
        );
      }
    }

    if (timeline.isEmpty) {
      timeline.add(
        TimelineItem(
          id: 'tl_created',
          title: 'Lead Created',
          description: 'Lead registered in CRM via ${json['source'] ?? 'Inbound'}',
          time: json['created_at'] != null ? json['created_at'].toString().split('T').first : 'Today',
          type: TimelineEventType.leadCreated,
        ),
      );
    }

    if (calls.isEmpty) {
      calls.add(
        const CallLogItem(
          id: 'call_initial',
          type: CallType.outgoing,
          status: CallStatus.connected,
          timeText: 'Initial Verification',
          duration: '01:30',
        ),
      );
    }

    // Extract chatbot tags or farm details
    String farmSize = '10 Acres';
    String primaryCrops = 'Crops & Farming';
    final List<String> tags = ['Score: ${json['score'] ?? 'Warm'}', 'Status: ${json['status'] ?? 'Active'}'];

    if (json['campaign_product_name'] != null && json['campaign_product_name'].toString().isNotEmpty) {
      tags.add(json['campaign_product_name'].toString());
    }

    if (json['chatbot_summary'] is Map<String, dynamic>) {
      final cb = json['chatbot_summary'] as Map<String, dynamic>;
      final vars = (cb['variables'] as Map<String, dynamic>?) ?? {};
      if (vars['land_acres'] != null) farmSize = '${vars['land_acres']} Acres';
      if (vars['product_interest'] != null) tags.add(vars['product_interest'].toString());
      if (vars['brush_cutter_type'] != null) tags.add(vars['brush_cutter_type'].toString().trim());
    }

    return LeadDetailModel(
      lead: lead,
      campaign: json['campaign_id_code']?.toString() ?? 'SGB CRM Campaign',
      language: json['language']?.toString() ?? 'English / Hindi',
      assignedTo: json['assigned_to_name']?.toString() ?? 'Assigned Telecaller',
      assignedToAvatar: 'assets/images/user_avatar.jpg',
      createdOn: json['created_at']?.toString() ?? 'Recent',
      lastContact: json['updated_at']?.toString() ?? 'Recent',
      tags: tags,
      source: json['source']?.toString() ?? 'WhatsApp Inbound',
      productInterest: json['campaign_product_name']?.toString() ?? 'Agri Solutions',
      calls: calls,
      timeline: timeline,
      purchaseSummary: purchaseSummary,
      purchases: purchases,
      farmSize: farmSize,
      primaryCrops: primaryCrops,
      soilType: 'Loamy Soil',
      irrigation: 'Drip / Tubewell',
      kycVerified: true,
    );
  }

  static LeadDetailModel sampleRameshKumar() {
    return const LeadDetailModel(
      lead: LeadModel(
        id: '1',
        name: 'Ramesh Kumar',
        phone: '+91 98765 43210',
        city: 'Jaipur',
        state: 'Rajasthan',
        time: '10:30 AM',
        status: LeadStatus.newLead,
        isToday: true,
        notes: 'Customer is interested in organic fertilizer. Asked for price and delivery details.',
      ),
      campaign: 'Monsoon Offer 2024',
      language: 'Hindi',
      assignedTo: 'Rahul Sharma',
      assignedToAvatar: 'assets/images/user_avatar.jpg',
      createdOn: '12 Sep 2024, 10:30 AM',
      lastContact: '12 Sep 2024, 10:30 AM',
      source: 'Facebook Ad - Campaign 1',
      productInterest: 'Organic Fertilizers',
      tags: [
        'Organic Fertilizer',
        'Wheat',
        'Price Inquiry',
      ],
      calls: [
        CallLogItem(
          id: 'call_1',
          type: CallType.outgoing,
          status: CallStatus.connected,
          timeText: 'Today, 10:30 AM',
          duration: '04:12',
          hasAudio: true,
          waveformPoints: [
            0.2, 0.5, 0.8, 0.4, 0.9, 0.7, 0.6, 0.3, 0.85, 0.95,
            0.6, 0.4, 0.75, 0.9, 0.5, 0.3, 0.7, 0.8, 0.4, 0.65,
            0.8, 0.55, 0.3, 0.7, 0.85, 0.4, 0.6, 0.9, 0.7, 0.5,
            0.35, 0.6, 0.8, 0.45, 0.3, 0.2
          ],
        ),
        CallLogItem(
          id: 'call_2',
          type: CallType.missed,
          status: CallStatus.noAnswer,
          timeText: '11 Sep, 04:20 PM',
          duration: '00:00',
        ),
        CallLogItem(
          id: 'call_3',
          type: CallType.outgoing,
          status: CallStatus.notReachable,
          timeText: '10 Sep, 11:15 AM',
          duration: '00:00',
        ),
        CallLogItem(
          id: 'call_4',
          type: CallType.outgoing,
          status: CallStatus.connected,
          timeText: '09 Sep, 03:40 PM',
          duration: '02:35',
        ),
      ],
      timeline: [
        TimelineItem(
          id: 'tl_1',
          title: 'Lead Created',
          description: 'Lead created from Facebook Ad - Campaign 1',
          time: '12 Sep 2024, 10:30 AM',
          type: TimelineEventType.leadCreated,
        ),
        TimelineItem(
          id: 'tl_2',
          title: 'Assigned to Rahul Sharma',
          description: 'Lead assigned to Rahul Sharma',
          time: '12 Sep 2024, 10:32 AM',
          type: TimelineEventType.assignedToAgent,
        ),
        TimelineItem(
          id: 'tl_3',
          title: 'Call - Connected',
          description: 'Outgoing call • 04:12',
          time: '12 Sep 2024, 10:30 AM',
          type: TimelineEventType.callConnected,
          hasAudioPlay: true,
          duration: '04:12',
        ),
        TimelineItem(
          id: 'tl_4',
          title: 'Note Added',
          description: 'Customer is interested in organic fertilizer. Asked for price and delivery details.',
          time: '12 Sep 2024, 11:00 AM',
          type: TimelineEventType.noteAdded,
        ),
        TimelineItem(
          id: 'tl_5',
          title: 'Follow-up Scheduled',
          description: 'Follow-up on 14 Sep 2024, 11:00 AM',
          time: '12 Sep 2024, 11:05 AM',
          type: TimelineEventType.followupScheduled,
        ),
        TimelineItem(
          id: 'tl_6',
          title: 'WhatsApp Message Sent',
          description: 'Product catalogue shared',
          time: '12 Sep 2024, 11:10 AM',
          type: TimelineEventType.whatsappSent,
        ),
        TimelineItem(
          id: 'tl_7',
          title: 'Status Updated',
          description: 'Changed from New to Follow-up',
          time: '12 Sep 2024, 11:10 AM',
          type: TimelineEventType.statusUpdated,
        ),
      ],
      purchaseSummary: PurchaseSummary(
        totalOrders: 3,
        totalValue: 24500,
        totalUnits: 16,
        lastOrderDate: '15 Aug 2024',
      ),
      purchases: [
        PurchaseItem(
          orderId: '#ORD-1024',
          orderDate: '15 Aug 2024',
          productName: 'Organic Fertilizer 5 kg',
          units: 10,
          price: 12000,
          status: 'Delivered',
          imageAsset: 'assets/images/fertilizer_bag.jpg',
        ),
        PurchaseItem(
          orderId: '#ORD-0987',
          orderDate: '22 Jun 2024',
          productName: 'Plant Growth Booster',
          units: 3,
          price: 4500,
          status: 'Delivered',
          imageAsset: 'assets/images/growth_booster.jpg',
        ),
        PurchaseItem(
          orderId: '#ORD-0765',
          orderDate: '10 Apr 2024',
          productName: 'Neem Oil 1 Ltr',
          units: 3,
          price: 8000,
          status: 'Delivered',
          imageAsset: 'assets/images/neem_oil.jpg',
        ),
      ],
      farmSize: '12 Acres',
      primaryCrops: 'Wheat, Mustard & Groundnut',
      soilType: 'Loamy Alluvial Soil',
      irrigation: 'Tubewell & Drip System',
      kycVerified: true,
    );
  }
}
