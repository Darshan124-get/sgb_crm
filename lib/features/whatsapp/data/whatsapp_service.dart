import 'dart:convert';
import 'dart:io';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/models/whatsapp_model.dart';
import 'services/quick_replies_storage_service.dart';

class WhatsAppCustomerResult {
  final List<WhatsAppConversation> conversations;
  final int totalCount;
  final int unreadCount;
  final int handoffCount;
  final int paymentCount;

  const WhatsAppCustomerResult({
    required this.conversations,
    required this.totalCount,
    required this.unreadCount,
    required this.handoffCount,
    required this.paymentCount,
  });
}

class WhatsAppService {
  /// Resolves any relative, localhost, or stale LAN media URL to the active connected backend host
  static String resolveMediaUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();

    // Data URI
    if (trimmed.startsWith('data:')) {
      return trimmed;
    }

    // Relative storage keys (e.g., chats/..., quick-replies/..., campaigns/...)
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      if (trimmed.startsWith('chats/') || trimmed.startsWith('quick-replies/') || trimmed.startsWith('campaigns/') || trimmed.startsWith('uploads/')) {
        return resolveMediaUrl('/api/media/$trimmed');
      }
      return trimmed;
    }

    final activeBase = ApiConfig.baseUrl.replaceAll(RegExp(r'/api$'), '');
    final baseUri = Uri.parse(activeBase);
    final activeHost = baseUri.host;
    final activePort = baseUri.hasPort ? baseUri.port : null;
    final activeScheme = baseUri.scheme.isNotEmpty ? baseUri.scheme : 'http';

    // If it's a media endpoint on our server, remap host and port dynamically to current server
    if (trimmed.contains('/api/media/')) {
      final pathAndQuery = trimmed.substring(trimmed.indexOf('/api/media/'));
      final portStr = activePort != null ? ':$activePort' : '';
      return '$activeScheme://$activeHost$portStr$pathAndQuery';
    }

    if (trimmed.startsWith('/')) {
      final portStr = activePort != null ? ':$activePort' : '';
      return '$activeScheme://$activeHost$portStr$trimmed';
    }

    final parsed = Uri.tryParse(trimmed);
    if (parsed != null) {
      if (parsed.host == '127.0.0.1' ||
          parsed.host == 'localhost' ||
          parsed.host == '10.0.2.2' ||
          parsed.host == '192.168.1.120') {
        return parsed.replace(
          scheme: activeScheme,
          host: activeHost,
          port: activePort,
        ).toString();
      }
    }

    return trimmed;
  }

  static Future<WhatsAppCustomerResult> getConversations({
    String? search,
    String? tab,
    int page = 1,
    int limit = 30,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }
    if (tab != null && tab.isNotEmpty && tab.toLowerCase() != 'all') {
      queryParams['tab'] = tab.toLowerCase();
    }

    final response = await ApiClient.get('/whatsapp/customers', queryParameters: queryParams);

    if (response.isSuccess && response.data != null) {
      final data = response.data;
      List<dynamic> rawCustomers = [];
      int total = 0;
      int unread = 0;
      int handoff = 0;
      int payment = 0;

      if (data is Map<String, dynamic>) {
        if (data['customers'] is List) {
          rawCustomers = data['customers'] as List<dynamic>;
        }
        total = int.tryParse(data['totalCount']?.toString() ?? '0') ?? rawCustomers.length;
        unread = int.tryParse(data['unreadCount']?.toString() ?? '0') ?? 0;
        handoff = int.tryParse(data['handoffCount']?.toString() ?? '0') ?? 0;
        payment = int.tryParse(data['paymentCount']?.toString() ?? '0') ?? 0;
      } else if (data is List) {
        rawCustomers = data;
        total = rawCustomers.length;
      }

      final conversations = rawCustomers
          .whereType<Map<String, dynamic>>()
          .map((item) => WhatsAppConversation.fromJson(item))
          .toList();

      return WhatsAppCustomerResult(
        conversations: conversations,
        totalCount: total,
        unreadCount: unread,
        handoffCount: handoff,
        paymentCount: payment,
      );
    }

    return const WhatsAppCustomerResult(
      conversations: [],
      totalCount: 0,
      unreadCount: 0,
      handoffCount: 0,
      paymentCount: 0,
    );
  }

  static Future<List<WhatsAppMessage>> getChatHistory(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    final response = await ApiClient.get('/whatsapp/history/$cleanPhone');

    if (response.isSuccess && response.data != null) {
      final data = response.data;
      List<dynamic> rawList = [];
      if (data is List) {
        rawList = data;
      } else if (data is Map<String, dynamic> && data['history'] is List) {
        rawList = data['history'] as List<dynamic>;
      }

      return rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => WhatsAppMessage.fromJson(item))
          .toList();
    }

    return [];
  }

  static Future<bool> sendMessage({
    required String phone,
    required String message,
    String? mediaData,
    String? mimeType,
    String? replyToChatId,
    bool isForwarded = false,
  }) async {
    String? payloadMediaData = mediaData;
    String? effectiveMime = mimeType;

    if (mediaData != null && !mediaData.startsWith('http') && !mediaData.startsWith('data:')) {
      try {
        final file = File(mediaData);
        if (file.existsSync()) {
          final bytes = await file.readAsBytes();
          final b64 = base64Encode(bytes);
          final lower = mediaData.toLowerCase();
          if (effectiveMime == null || effectiveMime.isEmpty) {
            if (lower.endsWith('.png')) {
              effectiveMime = 'image/png';
            } else if (lower.endsWith('.webp')) {
              effectiveMime = 'image/webp';
            } else if (lower.endsWith('.mp4')) {
              effectiveMime = 'video/mp4';
            } else if (lower.endsWith('.pdf')) {
              effectiveMime = 'application/pdf';
            } else if (lower.endsWith('.mp3') || lower.endsWith('.opus') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.aac')) {
              effectiveMime = 'audio/mp3';
            } else {
              effectiveMime = 'image/jpeg';
            }
          }
          payloadMediaData = 'data:$effectiveMime;base64,$b64';
        }
      } catch (e) {
        // Fallback to sending path or string
      }
    } else if (payloadMediaData != null && payloadMediaData.startsWith('data:')) {
      if (effectiveMime == null || effectiveMime.isEmpty) {
        final match = RegExp(r'^data:([^;]+);base64,').firstMatch(payloadMediaData);
        if (match != null) {
          effectiveMime = match.group(1);
        }
      }
    }

    if (payloadMediaData != null && (effectiveMime == null || effectiveMime.isEmpty)) {
      effectiveMime = 'image/jpeg';
    }

    final response = await ApiClient.post(
      '/whatsapp/send',
      body: {
        'phone': phone,
        'message': message,
        if (payloadMediaData != null) 'mediaData': payloadMediaData,
        if (effectiveMime != null) 'mimeType': effectiveMime,
        if (replyToChatId != null) 'reply_to_chat_id': replyToChatId,
        if (isForwarded) 'is_forwarded': true,
      },
    );
    return response.isSuccess;
  }

  static Future<bool> deleteMessage(String chatId, {bool forEveryone = false}) async {
    final response = await ApiClient.delete(
      '/whatsapp/message/$chatId',
      queryParameters: {'deleteType': forEveryone ? 'for_everyone' : 'for_me'},
    );
    return response.isSuccess;
  }

  static Future<List<WhatsAppQuickReply>> getQuickReplies() async {
    return await QuickRepliesStorageService.getQuickReplies();
  }

  static Future<void> markRead(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    await ApiClient.put('/whatsapp/customers/$cleanPhone/read');
  }
}
