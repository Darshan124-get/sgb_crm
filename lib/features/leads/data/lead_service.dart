import '../../../core/network/api_client.dart';
import '../domain/models/lead_detail_model.dart';
import '../domain/models/lead_model.dart';

class LeadPaginationResult {
  final List<LeadModel> leads;
  final int totalLeads;
  final int totalPages;
  final int currentPage;
  final Map<String, int> counts;

  const LeadPaginationResult({
    required this.leads,
    required this.totalLeads,
    required this.totalPages,
    required this.currentPage,
    this.counts = const {},
  });
}

class LeadService {
  static Future<LeadPaginationResult> getLeadsPaginated({
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
      int totalLeads = 0;
      int totalPages = 1;
      int currentPage = page;
      Map<String, int> counts = {};

      if (data is Map<String, dynamic>) {
        if (data['leads'] is List) {
          list = data['leads'] as List<dynamic>;
        }
        totalLeads = (data['totalLeads'] as num?)?.toInt() ?? 0;
        totalPages = (data['totalPages'] as num?)?.toInt() ?? 1;
        currentPage = (data['currentPage'] as num?)?.toInt() ?? page;
        if (data['counts'] is Map) {
          final rawCounts = data['counts'] as Map;
          rawCounts.forEach((k, v) {
            counts[k.toString()] = (v is num) ? v.toInt() : (int.tryParse(v.toString()) ?? 0);
          });
        }
      } else if (data is List) {
        list = data;
        totalLeads = list.length;
      }

      final leads = list
          .whereType<Map<String, dynamic>>()
          .map((item) => LeadModel.fromJson(item))
          .toList();

      return LeadPaginationResult(
        leads: leads,
        totalLeads: totalLeads > 0 ? totalLeads : leads.length,
        totalPages: totalPages,
        currentPage: currentPage,
        counts: counts,
      );
    }

    return LeadPaginationResult(
      leads: [],
      totalLeads: 0,
      totalPages: 1,
      currentPage: page,
      counts: {},
    );
  }

  static Future<List<LeadModel>> getLeads({
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    final result = await getLeadsPaginated(
      status: status,
      search: search,
      page: page,
      limit: limit,
    );
    return result.leads;
  }

  static Future<Map<String, int>> getLeadStats({String? search}) async {
    final queryParams = <String, dynamic>{};
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }

    final response = await ApiClient.get('/leads/stats', queryParameters: queryParams);

    if (response.isSuccess && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      final counts = <String, int>{};
      data.forEach((k, v) {
        counts[k.toString()] = (v is num) ? v.toInt() : (int.tryParse(v.toString()) ?? 0);
      });
      return counts;
    }

    return {};
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

