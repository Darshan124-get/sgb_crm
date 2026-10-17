import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/models/whatsapp_model.dart';

/// Service responsible for storing, retrieving, creating, editing, and deleting
/// custom quick replies locally on the telecaller's device using [SharedPreferences].
/// Does NOT seed any mock or static data.
class QuickRepliesStorageService {
  static const String _storageKey = 'telecaller_custom_quick_replies_v2';

  /// Loads all custom quick replies stored on this device.
  /// Does NOT seed mock data; starts empty until the telecaller creates their own.
  static Future<List<WhatsAppQuickReply>> getQuickReplies() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_storageKey);

      if (jsonString != null && jsonString.isNotEmpty) {
        final dynamic decoded = jsonDecode(jsonString);
        if (decoded is List) {
          final list = decoded
              .whereType<Map<String, dynamic>>()
              .map((item) => WhatsAppQuickReply.fromJson(item))
              .toList();

          return list;
        }
      }

      return <WhatsAppQuickReply>[];
    } catch (e) {
      debugPrint('QuickRepliesStorageService.getQuickReplies error: $e');
      return <WhatsAppQuickReply>[];
    }
  }

  /// Persists the full list of quick replies to local device storage.
  static Future<bool> saveQuickReplies(List<WhatsAppQuickReply> replies) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final listMaps = replies.map((r) => r.toJson()).toList();
      final jsonString = jsonEncode(listMaps);
      return await prefs.setString(_storageKey, jsonString);
    } catch (e) {
      debugPrint('QuickRepliesStorageService.saveQuickReplies error: $e');
      return false;
    }
  }

  /// Adds a new quick reply to local device storage.
  /// If a reply with the exact same shortcut already exists, it updates it.
  static Future<List<WhatsAppQuickReply>> addQuickReply(WhatsAppQuickReply reply) async {
    final current = await getQuickReplies();
    final updated = List<WhatsAppQuickReply>.from(current);

    // Normalize shortcut with leading slash
    final normalizedShortcut = reply.shortcut.startsWith('/')
        ? reply.shortcut.trim()
        : '/${reply.shortcut.trim()}';

    final normalizedReply = reply.copyWith(
      shortcut: normalizedShortcut,
      id: reply.id.isNotEmpty
          ? reply.id
          : 'qr_${DateTime.now().millisecondsSinceEpoch}_${normalizedShortcut.replaceAll('/', '')}',
    );

    final existingIndex = updated.indexWhere(
      (r) => (r.id.isNotEmpty && r.id == normalizedReply.id) ||
             r.shortcut.toLowerCase() == normalizedReply.shortcut.toLowerCase(),
    );

    if (existingIndex >= 0) {
      updated[existingIndex] = normalizedReply;
    } else {
      updated.insert(0, normalizedReply);
    }

    await saveQuickReplies(updated);
    return updated;
  }

  /// Updates an existing quick reply on local device storage.
  static Future<List<WhatsAppQuickReply>> updateQuickReply(WhatsAppQuickReply reply) async {
    final current = await getQuickReplies();
    final updated = List<WhatsAppQuickReply>.from(current);

    final normalizedShortcut = reply.shortcut.startsWith('/')
        ? reply.shortcut.trim()
        : '/${reply.shortcut.trim()}';

    final normalizedReply = reply.copyWith(shortcut: normalizedShortcut);

    final index = updated.indexWhere(
      (r) => (r.id.isNotEmpty && r.id == normalizedReply.id) ||
             r.shortcut.toLowerCase() == normalizedReply.shortcut.toLowerCase(),
    );

    if (index >= 0) {
      updated[index] = normalizedReply;
      await saveQuickReplies(updated);
    } else {
      await addQuickReply(normalizedReply);
    }

    return updated;
  }

  /// Deletes a quick reply from local device storage by ID or shortcut.
  static Future<List<WhatsAppQuickReply>> deleteQuickReply(String idOrShortcut) async {
    final current = await getQuickReplies();
    final updated = current.where((r) {
      final matchId = r.id.isNotEmpty && r.id == idOrShortcut;
      final matchShortcut = r.shortcut.toLowerCase() == idOrShortcut.toLowerCase();
      return !matchId && !matchShortcut;
    }).toList();

    await saveQuickReplies(updated);
    return updated;
  }

  /// Clears all stored quick replies from local storage.
  static Future<List<WhatsAppQuickReply>> clearAllReplies() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
    return <WhatsAppQuickReply>[];
  }

  /// Resets local quick replies (empty).
  static Future<List<WhatsAppQuickReply>> resetToDefaults() async {
    return await clearAllReplies();
  }
}
