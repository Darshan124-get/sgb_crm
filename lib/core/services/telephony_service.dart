import 'package:flutter/material.dart';
import '../network/api_client.dart';

class TelephonyCallResult {
  final bool success;
  final int? callId;
  final String? refId;
  final String message;

  const TelephonyCallResult({
    required this.success,
    this.callId,
    this.refId,
    required this.message,
  });
}

class TelephonyService {
  /// Initiates an outbound Click-to-Call request via the Acefone API backend.
  static Future<TelephonyCallResult> initiateClickToCall({
    String? leadId,
    required String destinationPhone,
  }) async {
    final cleanPhone = destinationPhone.trim();
    if (cleanPhone.isEmpty) {
      return const TelephonyCallResult(
        success: false,
        message: 'Customer phone number is required.',
      );
    }

    final payload = <String, dynamic>{
      'destination_phone': cleanPhone,
    };
    if (leadId != null && leadId.isNotEmpty) {
      payload['lead_id'] = leadId;
    }

    try {
      final response = await ApiClient.post('/telephony/click-to-call', body: payload);

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final isSuccess = data['success'] == true;
        if (isSuccess) {
          return TelephonyCallResult(
            success: true,
            callId: int.tryParse(data['call_id']?.toString() ?? ''),
            refId: data['acefone_ref_id']?.toString(),
            message: data['message']?.toString() ??
                'Acefone is ringing your phone now! Once answered, it connects to the customer.',
          );
        } else {
          return TelephonyCallResult(
            success: false,
            message: data['error']?.toString() ??
                data['message']?.toString() ??
                'Failed to initiate Acefone click to call.',
          );
        }
      }

      return TelephonyCallResult(
        success: false,
        message: response.errorMessage ?? 'Network error connecting to Acefone telephony service.',
      );
    } catch (e) {
      return TelephonyCallResult(
        success: false,
        message: 'Error connecting to telephony: $e',
      );
    }
  }

  /// High-level utility to trigger Acefone click to call with interactive feedback UI.
  static Future<void> dialLead(
    BuildContext context, {
    String? leadId,
    required String leadName,
    required String phone,
  }) async {
    final messenger = ScaffoldMessenger.of(context);

    // Initial feedback snackbar
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Connecting Acefone Click-to-Call to $leadName ($phone)...',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF0A5844),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );

    final result = await initiateClickToCall(
      leadId: leadId,
      destinationPhone: phone,
    );

    if (!context.mounted) return;

    messenger.hideCurrentSnackBar();

    if (result.success) {
      messenger.showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '📞 Acefone Click-to-Call Initiated!',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      result.message.isNotEmpty
                          ? result.message
                          : 'Your phone/extension will ring first, then connect to $leadName.',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 5),
        ),
      );
    } else {
      messenger.showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.white, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Call Failed: ${result.message}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }
}
