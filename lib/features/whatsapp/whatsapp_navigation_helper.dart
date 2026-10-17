import 'package:flutter/material.dart';
import 'domain/models/whatsapp_model.dart';
import 'presentation/pages/whatsapp_chat_page.dart';

class WhatsAppNavigationHelper {
  /// Builds a fully initialized [WhatsAppConversation] for a lead.
  static WhatsAppConversation createConversationForLead({
    required String leadId,
    required String phone,
    required String customerName,
    String? city,
    String? state,
    String? initialNote,
  }) {
    final digitsOnly = phone.replaceAll(RegExp(r'\D'), '');
    final cleanPhone = digitsOnly.length >= 10
        ? digitsOnly.substring(digitsOnly.length - 10)
        : digitsOnly;

    return WhatsAppConversation(
      id: 'lead_$leadId',
      name: customerName.trim().isNotEmpty ? customerName.trim() : 'Customer ($cleanPhone)',
      phone: phone.trim().isNotEmpty ? phone.trim() : '+91 $cleanPhone',
      lastMessage: initialNote?.trim().isNotEmpty == true
          ? initialNote!.trim()
          : 'Started WhatsApp chat via CRM',
      time: 'Now',
      avatarBgColor: const Color(0xFF007A65),
      avatarTextColor: Colors.white,
      location: [
        if (city != null && city.trim().isNotEmpty) city.trim(),
        if (state != null && state.trim().isNotEmpty) state.trim(),
      ].join(', '),
      messages: const [],
      isHandoff: false,
      is24hActive: true,
    );
  }

  /// Instantly navigates to [WhatsAppChatPage] using BuildContext.
  static void openChatForLead(
    BuildContext context, {
    required String leadId,
    required String phone,
    required String customerName,
    String? city,
    String? state,
    String? initialNote,
  }) {
    final conv = createConversationForLead(
      leadId: leadId,
      phone: phone,
      customerName: customerName,
      city: city,
      state: state,
      initialNote: initialNote,
    );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WhatsAppChatPage(conversation: conv),
      ),
    );
  }

  /// Instantly navigates to [WhatsAppChatPage] using NavigatorState.
  static void openChatForLeadWithNavigator(
    NavigatorState navigator, {
    required String leadId,
    required String phone,
    required String customerName,
    String? city,
    String? state,
    String? initialNote,
  }) {
    final conv = createConversationForLead(
      leadId: leadId,
      phone: phone,
      customerName: customerName,
      city: city,
      state: state,
      initialNote: initialNote,
    );

    navigator.push(
      MaterialPageRoute(
        builder: (_) => WhatsAppChatPage(conversation: conv),
      ),
    );
  }
}
