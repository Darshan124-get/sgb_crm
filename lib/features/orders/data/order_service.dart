import '../../../core/network/api_client.dart';
import '../domain/models/order_model.dart';

class OrderService {
  static Future<List<OrderModel>> getOrders({
    String? status,
    String? source,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{};
    if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') {
      queryParams['status'] = status.toLowerCase();
    }
    if (source != null && source.isNotEmpty && source.toLowerCase() != 'all') {
      queryParams['source'] = source.toLowerCase();
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }

    final response = await ApiClient.get('/orders', queryParameters: queryParams);

    if (response.isSuccess && response.data != null) {
      final data = response.data;
      List<dynamic> list = [];
      if (data is List) {
        list = data;
      } else if (data is Map<String, dynamic> && data['orders'] is List) {
        list = data['orders'] as List<dynamic>;
      }

      return list
          .whereType<Map<String, dynamic>>()
          .map((item) => OrderModel.fromJson(item))
          .toList();
    }

    return [];
  }

  static Future<bool> updateOrderStatus(String orderId, String newStatus) async {
    final cleanId = orderId.replaceAll(RegExp(r'^[^\d]+'), '');
    final response = await ApiClient.patch(
      '/orders/$cleanId/status',
      body: {'status': newStatus},
    );
    return response.isSuccess;
  }
}
