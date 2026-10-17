import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';
import '../../../../core/storage/session_storage.dart';
import '../domain/models/telecaller_daily_report_model.dart';

class TelecallerReportService {
  /// Fetches daily summary metrics from backend
  static Future<TelecallerDailyReportModel> fetchDailySummary({String? date}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (date != null && date.isNotEmpty) {
        queryParams['date'] = date;
      }

      final response = await ApiClient.get('/reports/telecaller/daily-summary', queryParameters: queryParams);

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true) {
          return TelecallerDailyReportModel.fromJson(data);
        }
      }

      return TelecallerDailyReportModel.sample();
    } catch (e) {
      debugPrint('Error fetching daily report: $e');
      return TelecallerDailyReportModel.sample();
    }
  }

  /// Downloads and opens the generated PDF report
  static Future<String?> downloadAndOpenPdfReport({String? date}) async {
    try {
      final base = ApiConfig.baseUrl.replaceAll(RegExp(r'/+$'), '');
      final dateParam = (date != null && date.isNotEmpty) ? '?date=$date' : '';
      final uri = Uri.parse('$base/reports/telecaller/daily-pdf$dateParam');

      final headers = <String, String>{};
      final token = SessionStorage.token;
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.get(uri, headers: headers);

      if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        final dir = await getApplicationDocumentsDirectory();
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final cleanDate = (date != null && date.isNotEmpty) ? date.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '') : '$timestamp';
        final filePath = '${dir.path}/Daily_Telecaller_Report_$cleanDate.pdf';

        final file = File(filePath);
        await file.writeAsBytes(response.bodyBytes);

        // Open with default system viewer if supported
        try {
          await OpenFilex.open(filePath);
        } catch (openErr) {
          debugPrint('OpenFilex failed: $openErr');
        }

        return filePath;
      } else {
        debugPrint('Failed to download PDF: HTTP ${response.statusCode}');
        return null;
      }
    } catch (e) {
      debugPrint('Error downloading PDF report: $e');
      return null;
    }
  }
}
