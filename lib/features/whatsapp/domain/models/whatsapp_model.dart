import 'dart:convert';
import 'package:flutter/material.dart';

enum MessageType {
  text,
  template,
  paymentProof,
  document,
  audio,
  image,
  video,
}

enum MessageStatus {
  sent,
  delivered,
  read,
}

class WhatsAppMessage {
  final String id;
  final String text;
  final String timestamp;
  final DateTime? rawTimestamp;
  final bool isOutgoing;
  final MessageStatus status;
  final MessageType type;
  final List<String> templateButtons;
  final String? mediaAsset;
  final String? mediaName;
  final String? mediaSize;
  final bool isPaymentVerified;
  final String? replyToText;
  final String? replyToSender;
  final String? replyToId;
  final bool isForwarded;
  final String? audioDuration;

  const WhatsAppMessage({
    required this.id,
    required this.text,
    required this.timestamp,
    this.rawTimestamp,
    required this.isOutgoing,
    this.status = MessageStatus.sent,
    this.type = MessageType.text,
    this.templateButtons = const [],
    this.mediaAsset,
    this.mediaName,
    this.mediaSize,
    this.isPaymentVerified = false,
    this.replyToText,
    this.replyToSender,
    this.replyToId,
    this.isForwarded = false,
    this.audioDuration,
  });

  factory WhatsAppMessage.fromJson(Map<String, dynamic> json) {
    final bodyText = json['body']?.toString() ?? json['message']?.toString() ?? '';
    final dir = json['direction']?.toString().toLowerCase();
    final senderType = json['sender_type']?.toString().toLowerCase();
    final isOut = dir == 'outgoing' || (senderType != null && senderType != 'user');

    final statusStr = json['status']?.toString().toLowerCase() ?? '';
    MessageStatus status = MessageStatus.sent;
    if (statusStr == 'read') {
      status = MessageStatus.read;
    } else if (statusStr == 'delivered') {
      status = MessageStatus.delivered;
    } else if (statusStr == 'sent') {
      status = MessageStatus.sent;
    }

    String timeFormatted = 'Now';
    DateTime? rawDt;
    final rawTimeStr = json['timestamp'] ?? json['created_at'];
    if (rawTimeStr != null) {
      final str = rawTimeStr.toString().trim();
      DateTime? dt = DateTime.tryParse(str);
      if (dt != null) {
        // If string didn't specify timezone, but backend timestamps are stored in UTC
        if (!dt.isUtc && !str.contains('+') && !str.endsWith('Z')) {
          dt = DateTime.utc(
            dt.year, dt.month, dt.day,
            dt.hour, dt.minute, dt.second,
            dt.millisecond, dt.microsecond,
          );
        }
        final localDt = dt.toLocal();
        rawDt = localDt;
        final hour = localDt.hour > 12 ? localDt.hour - 12 : (localDt.hour == 0 ? 12 : localDt.hour);
        final amPm = localDt.hour >= 12 ? 'PM' : 'AM';
        final min = localDt.minute.toString().padLeft(2, '0');
        timeFormatted = '$hour:$min $amPm';
      }
    }

    MessageType type = MessageType.text;
    final mediaUrl = json['media_url']?.toString();
    final mime = json['mime_type']?.toString().toLowerCase() ?? '';
    final mType = json['media_type']?.toString().toLowerCase() ?? '';
    if (mediaUrl != null && mediaUrl.isNotEmpty) {
      if (mime.contains('image') || mType.contains('image') || mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.jpeg') || mediaUrl.endsWith('.png') || mediaUrl.endsWith('.webp')) {
        type = MessageType.image;
      } else if (mime.contains('video') || mType.contains('video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov') || mediaUrl.endsWith('.mkv')) {
        type = MessageType.video;
      } else if (mime.contains('audio') || mType.contains('audio') || mediaUrl.endsWith('.mp3') || mediaUrl.endsWith('.opus') || mediaUrl.endsWith('.ogg') || mediaUrl.endsWith('.m4a') || mediaUrl.endsWith('.aac')) {
        type = MessageType.audio;
      } else {
        type = MessageType.document;
      }
    } else if (bodyText.toLowerCase().startsWith('voice note') || bodyText.toLowerCase().startsWith('voice message')) {
      type = MessageType.audio;
    }

    String? mediaName = json['media_name']?.toString();
    if (mediaName == null || mediaName.isEmpty || mediaName.contains('/') || mediaName.toLowerCase() == 'image/jpeg') {
      if (mediaUrl != null && mediaUrl.isNotEmpty) {
        final lastPart = mediaUrl.split('/').last.split('?').first;
        final clean = lastPart.replaceFirst(RegExp(r'^\d+[_-]'), '');
        mediaName = clean.isNotEmpty ? clean : lastPart;
      } else {
        mediaName = type == MessageType.image ? 'Photo' : (type == MessageType.video ? 'Video' : (type == MessageType.audio ? 'Voice Note' : 'Document'));
      }
    }

    final isFwd = json['is_forwarded'] == 1 || json['is_forwarded'] == true;
    final replyId = json['reply_to_chat_id']?.toString() ?? json['reply_to_message_id']?.toString();
    final replyText = json['reply_to_text']?.toString() ?? json['reply_text']?.toString();
    final replySender = json['reply_to_sender']?.toString() ?? json['reply_sender']?.toString();

    // Strip synthetic fallback strings ('Sent a image', 'Sent a video', 'Sent a audio', etc.)
    String cleanBodyText = bodyText;
    if (type != MessageType.text && isSyntheticMediaText(bodyText)) {
      cleanBodyText = '';
    }

    return WhatsAppMessage(
      id: json['chat_id']?.toString() ?? json['message_id']?.toString() ?? 'msg',
      text: cleanBodyText,
      timestamp: timeFormatted,
      rawTimestamp: rawDt,
      isOutgoing: isOut,
      status: status,
      type: type,
      mediaAsset: mediaUrl,
      mediaName: mediaName,
      replyToId: replyId,
      replyToText: replyText,
      replyToSender: replySender,
      isForwarded: isFwd,
    );
  }

  static bool isSyntheticMediaText(String text) {
    final lower = text.trim().toLowerCase();
    return lower.isEmpty ||
        lower == 'sent a image' ||
        lower == 'sent an image' ||
        lower == 'sent a video' ||
        lower == 'sent an video' ||
        lower == 'sent a audio' ||
        lower == 'sent an audio' ||
        lower == 'sent a document' ||
        lower == 'sent an document' ||
        lower == 'media attachment' ||
        lower == 'photo' ||
        lower == 'video' ||
        lower == 'voice note' ||
        lower == 'voice message';
  }

  WhatsAppMessage copyWith({
    String? id,
    String? text,
    String? timestamp,
    DateTime? rawTimestamp,
    bool? isOutgoing,
    MessageStatus? status,
    MessageType? type,
    List<String>? templateButtons,
    String? mediaAsset,
    String? mediaName,
    String? mediaSize,
    bool? isPaymentVerified,
    String? replyToText,
    String? replyToSender,
    String? replyToId,
    bool? isForwarded,
    String? audioDuration,
  }) {
    return WhatsAppMessage(
      id: id ?? this.id,
      text: text ?? this.text,
      timestamp: timestamp ?? this.timestamp,
      rawTimestamp: rawTimestamp ?? this.rawTimestamp,
      isOutgoing: isOutgoing ?? this.isOutgoing,
      status: status ?? this.status,
      type: type ?? this.type,
      templateButtons: templateButtons ?? this.templateButtons,
      mediaAsset: mediaAsset ?? this.mediaAsset,
      mediaName: mediaName ?? this.mediaName,
      mediaSize: mediaSize ?? this.mediaSize,
      isPaymentVerified: isPaymentVerified ?? this.isPaymentVerified,
      replyToText: replyToText ?? this.replyToText,
      replyToSender: replyToSender ?? this.replyToSender,
      replyToId: replyToId ?? this.replyToId,
      isForwarded: isForwarded ?? this.isForwarded,
      audioDuration: audioDuration ?? this.audioDuration,
    );
  }
}

class WhatsAppConversation {
  final String id;
  final String name;
  final String phone;
  final String lastMessage;
  final String time;
  final int unreadCount;
  final bool isHandoff;
  final bool isPaymentPending;
  final String? campaign;
  final bool isOnline;
  final int windowHoursLeft;
  final Color avatarBgColor;
  final Color avatarTextColor;
  final String location;
  final String crop;
  final String acreage;
  final String language;
  final List<WhatsAppMessage> messages;
  final String? leadCategory;
  final String? assignedName;
  final bool isOutgoing;
  final bool is24hActive;
  final String? lastMessageStatus;

  const WhatsAppConversation({
    required this.id,
    required this.name,
    required this.phone,
    required this.lastMessage,
    required this.time,
    this.unreadCount = 0,
    this.isHandoff = false,
    this.isPaymentPending = false,
    this.campaign,
    this.isOnline = true,
    this.windowHoursLeft = 24,
    required this.avatarBgColor,
    required this.avatarTextColor,
    this.location = 'Jaipur, Rajasthan',
    this.crop = 'Wheat & Mustard',
    this.acreage = '12 Acres',
    this.language = 'Hindi',
    this.messages = const [],
    this.leadCategory,
    this.assignedName,
    this.isOutgoing = true,
    this.is24hActive = true,
    this.lastMessageStatus,
  });

  static Color _getAvatarBg(String seed) {
    const bgColors = [
      Color(0xFF007A65), // Dark teal (1st & 3rd in reference)
      Color(0xFFDC2626), // Red (2nd in reference)
      Color(0xFF00897B), // Green-teal (4th in reference)
      Color(0xFF0284C7), // Sky blue (5th in reference)
      Color(0xFF0D9488), // Emerald
      Color(0xFFEA580C), // Orange
      Color(0xFF7C3AED), // Violet
      Color(0xFFE11D48), // Rose
    ];
    return bgColors[seed.hashCode.abs() % bgColors.length];
  }

  static Color _getAvatarText(String name) {
    return Colors.white;
  }

  factory WhatsAppConversation.fromJson(Map<String, dynamic> json) {
    final rawName = (json['customer_name'] as String?)?.trim();
    final phone = json['phone_number']?.toString() ?? json['phone']?.toString() ?? '';
    final name = (rawName != null && rawName.isNotEmpty) ? rawName : (phone.isNotEmpty ? phone : 'Customer');

    String timeFormatted = 'Today';
    final lastMsgAt = json['last_message_at'] ?? json['created_at'];
    if (lastMsgAt != null) {
      final str = lastMsgAt.toString().trim();
      DateTime? dt = DateTime.tryParse(str);
      if (dt != null) {
        if (!dt.isUtc && !str.contains('+') && !str.endsWith('Z')) {
          dt = DateTime.utc(
            dt.year, dt.month, dt.day,
            dt.hour, dt.minute, dt.second,
            dt.millisecond, dt.microsecond,
          );
        }
        final localDt = dt.toLocal();
        final now = DateTime.now();
        final isToday = localDt.year == now.year && localDt.month == now.month && localDt.day == now.day;
        final yesterday = now.subtract(const Duration(days: 1));
        final isYesterday = localDt.year == yesterday.year && localDt.month == yesterday.month && localDt.day == yesterday.day;

        final hour = localDt.hour > 12 ? localDt.hour - 12 : (localDt.hour == 0 ? 12 : localDt.hour);
        final amPm = localDt.hour >= 12 ? 'PM' : 'AM';
        final min = localDt.minute.toString().padLeft(2, '0');

        if (isToday) {
          timeFormatted = '$hour:$min $amPm';
        } else if (isYesterday) {
          timeFormatted = 'Yesterday';
        } else {
          timeFormatted = '${localDt.day}/${localDt.month}/${localDt.year.toString().substring(2)}';
        }
      }
    }

    final isHandoff = json['session_status'] == 'paused_for_human' ||
        json['status'] == 'human_needed' ||
        json['is_call_support'] == true;

    final isPaymentPending = json['has_pending_payment'] == true ||
        json['payment_order_id'] != null;

    final unread = int.tryParse(json['unread_msg_count']?.toString() ?? '0') ?? 0;

    String location = '';
    if (json['city'] != null && json['city'].toString().isNotEmpty) {
      location = json['city'].toString();
    }
    if (json['state'] != null && json['state'].toString().isNotEmpty) {
      location = location.isNotEmpty ? '$location, ${json['state']}' : json['state'].toString();
    }
    if (location.isEmpty) location = 'Rural India';

    // Parse lead category / score (COLD, WARM, HOT)
    final rawCategory = (json['score'] ?? json['lead_category'] ?? json['status'])?.toString().toLowerCase();
    String? leadCategory;
    if (rawCategory != null) {
      if (rawCategory.contains('cold')) {
        leadCategory = 'COLD';
      } else if (rawCategory.contains('warm')) {
        leadCategory = 'WARM';
      } else if (rawCategory.contains('hot')) {
        leadCategory = 'HOT';
      }
    }

    final assignedName = json['assigned_name']?.toString();
    final senderType = json['last_message_sender_type']?.toString().toLowerCase();
    final isOutgoing = senderType != null && senderType != 'user';
    final lastStatus = json['last_message_status']?.toString();

    // Check 24-hour window
    bool is24hActive = true;
    int windowHoursLeft = 24;
    final lastInbound = json['last_inbound_at'] ?? json['last_message_at'];
    if (lastInbound != null) {
      final dt = DateTime.tryParse(lastInbound.toString());
      if (dt != null) {
        final diff = DateTime.now().difference(dt);
        is24hActive = diff.inHours < 24;
        windowHoursLeft = (24 - diff.inHours).clamp(0, 24);
      }
    }

    return WhatsAppConversation(
      id: json['lead_id']?.toString() ?? json['phone']?.toString() ?? 'conv',
      name: name,
      phone: phone,
      lastMessage: json['last_message']?.toString() ?? 'Tap to chat with customer',
      time: timeFormatted,
      unreadCount: unread,
      isHandoff: isHandoff,
      isPaymentPending: isPaymentPending,
      campaign: json['campaign_product_name']?.toString() ?? json['call_support_product']?.toString(),
      isOnline: true,
      windowHoursLeft: windowHoursLeft,
      avatarBgColor: _getAvatarBg(phone.isNotEmpty ? phone : name),
      avatarTextColor: _getAvatarText(phone.isNotEmpty ? phone : name),
      location: location,
      crop: json['current_crop']?.toString() ?? 'Crops & Farming',
      acreage: json['acreage'] != null ? '${json['acreage']} Acres' : 'Field Farm',
      language: json['language']?.toString() ?? 'Hindi / English',
      leadCategory: leadCategory,
      assignedName: assignedName,
      isOutgoing: isOutgoing,
      is24hActive: is24hActive,
      lastMessageStatus: lastStatus,
    );
  }

  WhatsAppConversation copyWith({
    String? id,
    String? name,
    String? phone,
    String? lastMessage,
    String? time,
    int? unreadCount,
    bool? isHandoff,
    bool? isPaymentPending,
    String? campaign,
    bool? isOnline,
    int? windowHoursLeft,
    Color? avatarBgColor,
    Color? avatarTextColor,
    String? location,
    String? crop,
    String? acreage,
    String? language,
    List<WhatsAppMessage>? messages,
    String? leadCategory,
    String? assignedName,
    bool? isOutgoing,
    bool? is24hActive,
    String? lastMessageStatus,
  }) {
    return WhatsAppConversation(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      lastMessage: lastMessage ?? this.lastMessage,
      time: time ?? this.time,
      unreadCount: unreadCount ?? this.unreadCount,
      isHandoff: isHandoff ?? this.isHandoff,
      isPaymentPending: isPaymentPending ?? this.isPaymentPending,
      campaign: campaign ?? this.campaign,
      isOnline: isOnline ?? this.isOnline,
      windowHoursLeft: windowHoursLeft ?? this.windowHoursLeft,
      avatarBgColor: avatarBgColor ?? this.avatarBgColor,
      avatarTextColor: avatarTextColor ?? this.avatarTextColor,
      location: location ?? this.location,
      crop: crop ?? this.crop,
      acreage: acreage ?? this.acreage,
      language: language ?? this.language,
      messages: messages ?? this.messages,
      leadCategory: leadCategory ?? this.leadCategory,
      assignedName: assignedName ?? this.assignedName,
      isOutgoing: isOutgoing ?? this.isOutgoing,
      is24hActive: is24hActive ?? this.is24hActive,
      lastMessageStatus: lastMessageStatus ?? this.lastMessageStatus,
    );
  }

  int get dynamicWindowHoursLeft {
    DateTime? lastInboundTime;
    for (int i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].isOutgoing && messages[i].rawTimestamp != null) {
        lastInboundTime = messages[i].rawTimestamp;
        break;
      }
    }
    if (lastInboundTime != null) {
      final diff = DateTime.now().difference(lastInboundTime);
      if (diff.inHours >= 24) return 0;
      return (24 - diff.inHours).clamp(0, 24);
    }
    return windowHoursLeft;
  }

  bool get isDynamic24hActive => dynamicWindowHoursLeft > 0;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase() : 'WA';
  }

  String get displayAvatar {
    final clean = name.trim();
    if (clean.isEmpty ||
        clean.toLowerCase().startsWith('customer') ||
        clean.toLowerCase().startsWith('farmer') ||
        RegExp(r'^[\d+\s-]+$').hasMatch(clean)) {
      return '?';
    }
    final parts = clean.split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (clean.length <= 2) return clean.toUpperCase();
    return '?';
  }

  static List<WhatsAppConversation> sampleConversations() {
    return [
      WhatsAppConversation(
        id: 'c1',
        name: 'Ramesh Kumar',
        phone: '+91 98765 43210',
        lastMessage: 'Need tractor tiller delivery before Friday. Can you confirm price?',
        time: '10:30 AM',
        unreadCount: 2,
        isHandoff: true,
        campaign: 'Monsoon Offer 2024',
        avatarBgColor: const Color(0xFF007A65),
        avatarTextColor: Colors.white,
        location: 'Jaipur, Rajasthan',
        crop: 'Wheat & Mustard',
        acreage: '12 Acres',
        language: 'Hindi',
        leadCategory: 'COLD',
        assignedName: 'Shaila',
        isOutgoing: true,
        is24hActive: true,
        messages: [
          const WhatsAppMessage(
            id: 'm1',
            text: 'Hello Ramesh Ji! Welcome to SGB Agro. How can we assist your farming today?',
            timestamp: '09:15 AM',
            isOutgoing: true,
            status: MessageStatus.read,
          ),
          const WhatsAppMessage(
            id: 'm2',
            text: 'Namaste. I saw your Monsoon Offer on Facebook for organic fertilizer and 7HP power tiller.',
            timestamp: '09:40 AM',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 'm3',
            text: 'Here is the detailed product brochure and current discount price list for Monsoon season:',
            timestamp: '09:42 AM',
            isOutgoing: true,
            status: MessageStatus.read,
            type: MessageType.document,
            mediaName: 'SGB_Monsoon_Catalogue_2024.pdf',
            mediaSize: '2.4 MB',
          ),
          const WhatsAppMessage(
            id: 'm4',
            text: 'Special Monsoon Discount Package: 10 Bags Organic Fertilizer + 1 Ltr Neem Oil at ₹12,000 only!',
            timestamp: '09:43 AM',
            isOutgoing: true,
            status: MessageStatus.read,
            type: MessageType.template,
            templateButtons: ['Interested', 'Call Telecaller', 'Order Now'],
          ),
          const WhatsAppMessage(
            id: 'm5',
            text: 'I want to talk to an agent directly. Please transfer me.',
            timestamp: '10:28 AM',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 'm6',
            text: 'Need tractor tiller delivery before Friday. Can you confirm price?',
            timestamp: '10:30 AM',
            isOutgoing: false,
          ),
        ],
      ),
      WhatsAppConversation(
        id: 'c2',
        name: 'Priya Singh',
        phone: '+91 87654 32109',
        lastMessage: 'Sent payment screenshot ₹12,000 via PhonePe',
        time: '10:15 AM',
        unreadCount: 1,
        isPaymentPending: true,
        campaign: 'Monsoon Offer 2024',
        avatarBgColor: const Color(0xFFDC2626),
        avatarTextColor: Colors.white,
        location: 'Ajmer, Rajasthan',
        crop: 'Cotton & Groundnut',
        acreage: '8.5 Acres',
        language: 'Hindi',
        leadCategory: 'COLD',
        assignedName: 'Shaila',
        isOutgoing: false,
        is24hActive: true,
        messages: [
          const WhatsAppMessage(
            id: 'p1',
            text: 'Please send UPI QR code to complete the order for 10 bags Organic Fertilizer.',
            timestamp: '09:50 AM',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 'p2',
            text: 'Here is the SGB Agro official UPI QR. Please pay ₹12,000 and share the screenshot here.',
            timestamp: '09:55 AM',
            isOutgoing: true,
            status: MessageStatus.read,
            type: MessageType.template,
            templateButtons: ['Pay via UPI', 'View Bank A/C'],
          ),
          const WhatsAppMessage(
            id: 'p3',
            text: 'Sent payment screenshot ₹12,000 via PhonePe',
            timestamp: '10:15 AM',
            isOutgoing: false,
            type: MessageType.paymentProof,
            mediaName: 'PhonePe_Transaction_Receipt.jpg',
            mediaSize: '410 KB',
            isPaymentVerified: false,
          ),
        ],
      ),
      WhatsAppConversation(
        id: 'c3',
        name: 'Amit Patel',
        phone: '+91 78965 43210',
        lastMessage: 'Product catalogue shared. Awaiting subsidy verification.',
        time: '09:45 AM',
        unreadCount: 0,
        campaign: 'Subsidies 2024',
        avatarBgColor: const Color(0xFF007A65),
        avatarTextColor: Colors.white,
        location: 'Kota, Rajasthan',
        crop: 'Soybean & Mustard',
        acreage: '15 Acres',
        language: 'Hindi',
        leadCategory: 'WARM',
        isOutgoing: true,
        is24hActive: true,
        messages: [
          const WhatsAppMessage(
            id: 'a1',
            text: 'Is government subsidy available on Neem oil and drip equipment?',
            timestamp: '09:20 AM',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 'a2',
            text: 'Yes! Up to 40% subsidy is available for registered farmers. Please share your Aadhaar & 7/12 land extract.',
            timestamp: '09:30 AM',
            isOutgoing: true,
            status: MessageStatus.read,
          ),
          const WhatsAppMessage(
            id: 'a3',
            text: 'Product catalogue shared. Awaiting subsidy verification.',
            timestamp: '09:45 AM',
            isOutgoing: true,
            status: MessageStatus.read,
          ),
        ],
      ),
      WhatsAppConversation(
        id: 'c4',
        name: 'Sunita Devi',
        phone: '+91 98712 34567',
        lastMessage: 'Subsidy document received. Follow-up tomorrow 11 AM.',
        time: '09:20 AM',
        unreadCount: 0,
        avatarBgColor: const Color(0xFFECFCCB),
        avatarTextColor: const Color(0xFF4D7C0F),
        location: 'Bikaner, Rajasthan',
        crop: 'Bajra & Pulses',
        acreage: '6 Acres',
        language: 'Hindi',
        messages: [
          const WhatsAppMessage(
            id: 's1',
            text: 'I have uploaded the tractor passbook copy.',
            timestamp: '09:10 AM',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 's2',
            text: 'Subsidy document received. Follow-up tomorrow 11 AM.',
            timestamp: '09:20 AM',
            isOutgoing: true,
            status: MessageStatus.read,
          ),
        ],
      ),
      WhatsAppConversation(
        id: 'c5',
        name: 'Vikram Reddy',
        phone: '+91 91234 56789',
        lastMessage: 'Please send dealership terms for southern Rajasthan.',
        time: 'Yesterday',
        unreadCount: 0,
        avatarBgColor: const Color(0xFFDCFCE7),
        avatarTextColor: const Color(0xFF166534),
        location: 'Udaipur, Rajasthan',
        crop: 'Maize & Sugarcane',
        acreage: '20 Acres',
        language: 'English',
        messages: [
          const WhatsAppMessage(
            id: 'v1',
            text: 'Interested in becoming authorized dealer for SGB bio-fertilizers in Udaipur.',
            timestamp: 'Yesterday',
            isOutgoing: false,
          ),
          const WhatsAppMessage(
            id: 'v2',
            text: 'Please send dealership terms for southern Rajasthan.',
            timestamp: 'Yesterday',
            isOutgoing: false,
          ),
        ],
      ),
    ];
  }
}

class WhatsAppQuickReply {
  final String id;
  final String shortcut;
  final String title;
  final String body;
  final String category;
  final String mediaType; // 'text', 'image', 'video', 'document', 'multi'
  final String? mediaUrl;
  final String? mediaName;
  final List<String> mediaUrls;
  final List<String> mediaTypes;
  final List<String> mediaNames;

  const WhatsAppQuickReply({
    this.id = '',
    required this.shortcut,
    required this.title,
    required this.body,
    required this.category,
    this.mediaType = 'text',
    this.mediaUrl,
    this.mediaName,
    this.mediaUrls = const [],
    this.mediaTypes = const [],
    this.mediaNames = const [],
  });

  bool get hasMedia =>
      mediaUrls.isNotEmpty || (mediaType != 'text' && mediaUrl != null && mediaUrl!.isNotEmpty);

  int get mediaCount => mediaUrls.isNotEmpty ? mediaUrls.length : (hasMedia ? 1 : 0);

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'shortcut': shortcut,
      'title': title,
      'body': body,
      'category': category,
      'mediaType': mediaType,
      'mediaUrl': mediaUrl,
      'mediaName': mediaName,
      'mediaUrls': mediaUrls,
      'mediaTypes': mediaTypes,
      'mediaNames': mediaNames,
    };
  }

  factory WhatsAppQuickReply.fromJson(Map<String, dynamic> json) {
    List<String> parsedUrls = [];
    List<String> parsedTypes = [];
    List<String> parsedNames = [];

    if (json['mediaUrls'] is List) {
      parsedUrls = (json['mediaUrls'] as List).map((e) => e.toString()).toList();
    }
    if (json['mediaTypes'] is List) {
      parsedTypes = (json['mediaTypes'] as List).map((e) => e.toString()).toList();
    }
    if (json['mediaNames'] is List) {
      parsedNames = (json['mediaNames'] as List).map((e) => e.toString()).toList();
    }

    String? singleUrl;
    final rawMediaUrl = json['media_url'] ?? json['mediaUrl'];
    if (rawMediaUrl != null) {
      final str = rawMediaUrl.toString();
      if (str.startsWith('[')) {
        try {
          final decoded = jsonDecode(str);
          if (decoded is List && decoded.isNotEmpty) {
            singleUrl = decoded.first.toString();
            if (parsedUrls.isEmpty) {
              parsedUrls = decoded.map((e) => e.toString()).toList();
            }
          }
        } catch (_) {
          singleUrl = str;
        }
      } else {
        singleUrl = str;
      }
    }

    if (singleUrl != null && singleUrl.isNotEmpty && parsedUrls.isEmpty) {
      parsedUrls = [singleUrl];
    }

    String parsedMediaType = 'text';
    final rawMediaType = json['media_type'] ?? json['mediaType'];
    if (rawMediaType != null) {
      final str = rawMediaType.toString().toLowerCase();
      if (str.contains('image')) {
        parsedMediaType = 'image';
      } else if (str.contains('video')) {
        parsedMediaType = 'video';
      } else if (str.contains('doc') || str.contains('pdf')) {
        parsedMediaType = 'document';
      } else if (str.isNotEmpty && str != 'text') {
        parsedMediaType = str;
      }
    } else if (parsedUrls.isNotEmpty) {
      final lower = parsedUrls.first.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.mkv')) {
        parsedMediaType = 'video';
      } else if (lower.endsWith('.pdf') || lower.endsWith('.doc')) {
        parsedMediaType = 'document';
      } else {
        parsedMediaType = 'image';
      }
    }

    while (parsedTypes.length < parsedUrls.length) {
      final u = parsedUrls[parsedTypes.length].toLowerCase();
      if (u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.mkv')) {
        parsedTypes.add('video');
      } else if (u.endsWith('.pdf') || u.endsWith('.doc')) {
        parsedTypes.add('document');
      } else {
        parsedTypes.add('image');
      }
    }

    while (parsedNames.length < parsedUrls.length) {
      parsedNames.add(parsedUrls[parsedNames.length].split('/').last.split('\\').last);
    }

    final shortcutStr = json['shortcut']?.toString() ?? '';
    final idStr = json['id']?.toString() ??
        (shortcutStr.isNotEmpty ? 'qr_${shortcutStr.replaceAll('/', '')}' : 'qr_${DateTime.now().millisecondsSinceEpoch}');

    return WhatsAppQuickReply(
      id: idStr,
      shortcut: shortcutStr,
      title: json['title']?.toString() ?? json['name']?.toString() ?? (shortcutStr.isNotEmpty ? shortcutStr : 'Quick Reply'),
      body: json['body']?.toString() ?? json['message']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General',
      mediaType: parsedUrls.length > 1 ? 'multi' : parsedMediaType,
      mediaUrl: parsedUrls.isNotEmpty ? parsedUrls.first : singleUrl,
      mediaName: parsedNames.isNotEmpty ? parsedNames.first : (json['media_name']?.toString() ?? json['mediaName']?.toString()),
      mediaUrls: parsedUrls,
      mediaTypes: parsedTypes,
      mediaNames: parsedNames,
    );
  }

  WhatsAppQuickReply copyWith({
    String? id,
    String? shortcut,
    String? title,
    String? body,
    String? category,
    String? mediaType,
    String? mediaUrl,
    String? mediaName,
    List<String>? mediaUrls,
    List<String>? mediaTypes,
    List<String>? mediaNames,
  }) {
    return WhatsAppQuickReply(
      id: id ?? this.id,
      shortcut: shortcut ?? this.shortcut,
      title: title ?? this.title,
      body: body ?? this.body,
      category: category ?? this.category,
      mediaType: mediaType ?? this.mediaType,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      mediaName: mediaName ?? this.mediaName,
      mediaUrls: mediaUrls ?? this.mediaUrls,
      mediaTypes: mediaTypes ?? this.mediaTypes,
      mediaNames: mediaNames ?? this.mediaNames,
    );
  }

  static List<WhatsAppQuickReply> defaultReplies() {
    return const [];
  }
}
