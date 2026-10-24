import '../../../core/network/api_client.dart';
import '../domain/models/lead_detail_model.dart';
import '../domain/models/lead_model.dart';

class LeadService {
  static Future<List<LeadModel>> getLeads({
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
      queryParams['status'] = status.toLowerCase();
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }

    final response = await ApiClient.get('/leads', queryParameters: queryParams);

    if (response.isSuccess && response.data != null) {
      final data = response.data;
      List<dynamic> list = [];

      if (data is Map<String, dynamic> && data['leads'] is List) {
        list = data['leads'] as List<dynamic>;
      } else if (data is List) {
        list = data;
      }

      return list
          .whereType<Map<String, dynamic>>()
          .map((item) => LeadModel.fromJson(item))
          .toList();
    }

    return [];
  }

  static Future<LeadDetailModel?> getLeadById(String id) async {
    final response = await ApiClient.get('/leads/$id');

    if (response.isSuccess && response.data is Map<String, dynamic>) {
      return LeadDetailModel.fromBackend(response.data as Map<String, dynamic>);
    }

    return null;
  }

  static Future<bool> updateLead(String id, Map<String, dynamic> data) async {
    final response = await ApiClient.put('/leads/$id', body: data);
    return response.isSuccess;
  }

  static Future<bool> addLeadNote(String id, String note) async {
    final response = await ApiClient.post(
      '/leads/$id/notes',
      body: {'note': note},
    );
    return response.isSuccess;
  }

  static Future<ApiResponse<dynamic>> createLead({
    required String phoneNumber,
    String? customerName,
    String? firstMessage,
    String? state,
    String? district,
    String? city,
  }) async {
    final body = <String, dynamic>{
      'phone_number': phoneNumber.trim(),
      'source': 'manual',
    };
    if (customerName != null && customerName.trim().isNotEmpty) {
      body['customer_name'] = customerName.trim();
    }
    if (firstMessage != null && firstMessage.trim().isNotEmpty) {
      body['first_message'] = firstMessage.trim();
    }
    if (state != null && state.trim().isNotEmpty) {
      body['state'] = state.trim();
    }
    if (district != null && district.trim().isNotEmpty) {
      body['district'] = district.trim();
    }
    if (city != null && city.trim().isNotEmpty) {
      body['city'] = city.trim();
    }

    return await ApiClient.post('/leads', body: body);
  }
}

