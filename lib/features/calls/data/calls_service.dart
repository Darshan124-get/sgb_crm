import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/services/telephony_service.dart';
import '../domain/models/call_record_model.dart';

class CallsPaginationResult {
  final List<CallRecordModel> calls;
  final int totalCalls;
  final int totalPages;
  final int currentPage;
  final Map<String, int> counts;

  const CallsPaginationResult({
    required this.calls,
    required this.totalCalls,
    required this.totalPages,
    required this.currentPage,
    this.counts = const {},
  });
}

class CallsService {
  /// Fetches recent call records with pagination and summary counts.
  static Future<CallsPaginationResult> fetchRecentCallsPaginated({
    int page = 1,
    int limit = 50,
    String? search,
    String? telecallerId,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (search != null && search.trim().isNotEmpty) {
        queryParams['search'] = search.trim();
      }
      if (telecallerId != null && telecallerId.trim().isNotEmpty) {
        queryParams['telecaller_id'] = telecallerId.trim();
      }
      if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
        queryParams['status'] = status.toLowerCase();
      }

      final response = await ApiClient.get('/telephony/recents', queryParameters: queryParams);

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final callsList = data['calls'];
        List<CallRecordModel> calls = [];
        if (callsList is List) {
          calls = callsList
              .whereType<Map<String, dynamic>>()
              .map((c) => CallRecordModel.fromJson(c))
              .toList();
        }
        final totalCalls = (data['totalCalls'] as num?)?.toInt() ?? calls.length;
        final totalPages = (data['totalPages'] as num?)?.toInt() ?? 1;
        final currentPage = (data['currentPage'] as num?)?.toInt() ?? page;
        final counts = <String, int>{};
        if (data['counts'] is Map) {
          (data['counts'] as Map).forEach((k, v) {
            counts[k.toString()] = (v is num) ? v.toInt() : (int.tryParse(v.toString()) ?? 0);
          });
        }
        return CallsPaginationResult(
          calls: calls,
          totalCalls: totalCalls,
          totalPages: totalPages,
          currentPage: currentPage,
          counts: counts,
        );
      }

      final samples = CallRecordModel.sampleCalls();
      return CallsPaginationResult(
        calls: samples,
        totalCalls: samples.length,
        totalPages: 1,
        currentPage: 1,
      );
    } catch (e) {
      debugPrint('Error fetching recent calls: $e');
      final samples = CallRecordModel.sampleCalls();
      return CallsPaginationResult(
        calls: samples,
        totalCalls: samples.length,
        totalPages: 1,
        currentPage: 1,
      );
    }
  }

  /// Legacy helper for unpaginated calls fetching
  static Future<List<CallRecordModel>> fetchRecentCalls({
    int limit = 50,
    String? search,
    String? telecallerId,
  }) async {
    final result = await fetchRecentCallsPaginated(
      page: 1,
      limit: limit,
      search: search,
      telecallerId: telecallerId,
    );
    return result.calls;
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
