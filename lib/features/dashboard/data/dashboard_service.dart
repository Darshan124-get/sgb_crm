import '../../../core/network/api_client.dart';
import '../../../core/storage/session_storage.dart';
import '../domain/models/dashboard_data.dart';

class DashboardService {
  static Future<DashboardData> getDashboardData({
    String? timeframe,
    String? date,
  }) async {
    final currentUser = SessionStorage.currentUser;
    final agentName = currentUser?.name.isNotEmpty == true ? currentUser!.name : 'Telecaller';

    final queryParams = <String, String>{};
    if (timeframe != null && timeframe.isNotEmpty) {
      queryParams['timeframe'] = timeframe;
    }
    if (date != null && date.isNotEmpty) {
      queryParams['date'] = date;
    }

    final queryString = queryParams.isNotEmpty
        ? '?${queryParams.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}'
        : '';

    // 1. Fetch dashboard-stats from backend report controller
    final statsResponse = await ApiClient.get('/reports/dashboard-stats$queryString');

    // 2. Fetch leads stats from backend lead controller
    final leadStatsResponse = await ApiClient.get('/leads/stats');

    Map<String, dynamic> stats = {};
    if (statsResponse.isSuccess && statsResponse.data is Map<String, dynamic>) {
      stats = statsResponse.data as Map<String, dynamic>;
    }

    Map<String, dynamic> leadStats = {};
    if (leadStatsResponse.isSuccess && leadStatsResponse.data is Map<String, dynamic>) {
      leadStats = leadStatsResponse.data as Map<String, dynamic>;
    }

    return DashboardData.fromBackend(
      stats: stats,
      leadStats: leadStats,
      agentName: agentName,
      timeframe: timeframe ?? 'Today',
      dateStr: date,
    );
  }
}
