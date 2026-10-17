import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/services/telephony_service.dart';
import '../domain/models/call_record_model.dart';

class CallsService {
  /// Fetches recent call records from Acefone CDR via backend.
  static Future<List<CallRecordModel>> fetchRecentCalls({
    int limit = 50,
    String? search,
    String? telecallerId,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'limit': limit.toString(),
      };
      if (search != null && search.trim().isNotEmpty) {
        queryParams['search'] = search.trim();
      }
      if (telecallerId != null && telecallerId.trim().isNotEmpty) {
        queryParams['telecaller_id'] = telecallerId.trim();
      }

      final response = await ApiClient.get('/telephony/recents', queryParameters: queryParams);

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final callsList = data['calls'];
        if (callsList is List) {
          return callsList
              .whereType<Map<String, dynamic>>()
              .map((c) => CallRecordModel.fromJson(c))
              .toList();
        }
      }

      // If backend returns empty or non-200 in dev/offline, return fallback sample
      return CallRecordModel.sampleCalls();
    } catch (e) {
      debugPrint('Error fetching recent calls: $e');
      return CallRecordModel.sampleCalls();
    }
  }

  /// Fetches single call details by ID.
  static Future<CallRecordModel?> fetchCallDetails(int callId) async {
    try {
      final response = await ApiClient.get('/telephony/calls/$callId');
      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        if (data['call'] is Map<String, dynamic>) {
          return CallRecordModel.fromJson(data['call'] as Map<String, dynamic>);
        }
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching call details: $e');
      return null;
    }
  }

  /// Triggers a sync of the latest CDR from Acefone API.
  static Future<bool> syncAcefoneCdr() async {
    try {
      final response = await ApiClient.post('/telephony/cdr/sync', body: {
        'limit': 50,
        'autoOffloadAudio': true,
      });
      return response.isSuccess;
    } catch (e) {
      debugPrint('Error syncing CDR: $e');
      return false;
    }
  }

  /// Dials a customer phone number via Acefone Click-to-Call.
  static Future<void> dialCustomer(
    BuildContext context, {
    required String phone,
    String? leadId,
    String? leadName,
  }) async {
    await TelephonyService.dialLead(
      context,
      phone: phone,
      leadId: leadId,
      leadName: leadName ?? (phone.isNotEmpty ? phone : 'Customer'),
    );
  }
}
