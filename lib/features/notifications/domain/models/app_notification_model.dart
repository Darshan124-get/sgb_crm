import 'dart:convert';

class AppNotificationModel {
  final String id;
  final String title;
  final String body;
  final String type; // 'lead_assigned', 'whatsapp_message', 'order_billed', 'general'
  final String? leadId;
  final DateTime timestamp;
  final bool isRead;
  final Map<String, dynamic> data;

  const AppNotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.leadId,
    required this.timestamp,
    this.isRead = false,
    this.data = const {},
  });

  AppNotificationModel copyWith({
    String? id,
    String? title,
    String? body,
    String? type,
    String? leadId,
    DateTime? timestamp,
    bool? isRead,
    Map<String, dynamic>? data,
  }) {
    return AppNotificationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      type: type ?? this.type,
      leadId: leadId ?? this.leadId,
      timestamp: timestamp ?? this.timestamp,
      isRead: isRead ?? this.isRead,
      data: data ?? this.data,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'body': body,
      'type': type,
      'leadId': leadId,
      'timestamp': timestamp.toIso8601String(),
      'isRead': isRead,
      'data': data,
    };
  }

  factory AppNotificationModel.fromJson(Map<String, dynamic> json) {
    return AppNotificationModel(
      id: json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      title: json['title']?.toString() ?? 'Notification',
      body: json['body']?.toString() ?? '',
      type: json['type']?.toString() ?? 'general',
      leadId: json['leadId']?.toString(),
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isRead: json['isRead'] == true,
      data: json['data'] is Map ? Map<String, dynamic>.from(json['data'] as Map) : {},
    );
  }

  static String encodeList(List<AppNotificationModel> list) {
    return jsonEncode(list.map((e) => e.toJson()).toList());
  }

  static List<AppNotificationModel> decodeList(String rawJson) {
    try {
      final List<dynamic> decoded = jsonDecode(rawJson) as List<dynamic>;
      return decoded
          .map((item) => AppNotificationModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
