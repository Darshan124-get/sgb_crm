import 'package:flutter/material.dart';
import '../../data/telecaller_report_service.dart';
import '../../domain/models/telecaller_daily_report_model.dart';

class DailyTelecallerReportSheet extends StatefulWidget {
  final TelecallerDailyReportModel? initialReport;

  const DailyTelecallerReportSheet({
    super.key,
    this.initialReport,
  });

  static Future<void> show(BuildContext context, {TelecallerDailyReportModel? initialReport}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DailyTelecallerReportSheet(initialReport: initialReport),
    );
  }

  @override
  State<DailyTelecallerReportSheet> createState() => _DailyTelecallerReportSheetState();
}

class _DailyTelecallerReportSheetState extends State<DailyTelecallerReportSheet> {
  TelecallerDailyReportModel? _report;
  bool _isLoading = true;
  bool _isDownloading = false;
  String? _selectedDateStr;

  @override
  void initState() {
    super.initState();
    if (widget.initialReport != null) {
      _report = widget.initialReport;
      _isLoading = false;
    } else {
      _loadReport();
    }
  }

  Future<void> _loadReport({String? date}) async {
    setState(() => _isLoading = true);
    final data = await TelecallerReportService.fetchDailySummary(date: date);
    if (!mounted) return;
    setState(() {
      _report = data;
      _isLoading = false;
    });
  }

  Future<void> _handleSelectDate() async {
    final now = DateTime.now();
    DateTime initial = now;
    if (_report?.date != null) {
      final parsed = DateTime.tryParse(_report!.date);
      if (parsed != null) initial = parsed;
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isAfter(now) ? now : initial,
      firstDate: DateTime(2024, 1, 1),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0A5844),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final yyyy = picked.year.toString();
      final mm = picked.month.toString().padLeft(2, '0');
      final dd = picked.day.toString().padLeft(2, '0');
      _selectedDateStr = '$yyyy-$mm-$dd';
      _loadReport(date: _selectedDateStr);
    }
  }

  Future<void> _handleDownloadPdf() async {
    if (_isDownloading) return;
    setState(() => _isDownloading = true);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            SizedBox(width: 12),
            Text('Generating publication PDF report...'),
          ],
        ),
        duration: Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
      ),
    );

    final filePath = await TelecallerReportService.downloadAndOpenPdfReport(
      date: _report?.date,
    );

    if (!mounted) return;
    setState(() => _isDownloading = false);

    if (filePath != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ PDF Report downloaded & opened!\nSaved: $filePath'),
          backgroundColor: const Color(0xFF0A5844),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to download PDF report. Check server connection.'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _report ?? TelecallerDailyReportModel.sample();
    final connPct = report.connectedPct.endsWith('%') ? report.connectedPct : '${report.connectedPct}%';
    final missPct = report.missedPct.endsWith('%') ? report.missedPct : '${report.missedPct}%';

    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      height: screenHeight * 0.94, // Fullscreen-style presentation
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Top Drag Handle
          const SizedBox(height: 10),
          Center(
            child: Container(
              width: 42,
              height: 4.5,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 12, 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.bar_chart_rounded, color: Color(0xFF0A5844), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Daily Telecaller Reports',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              '${report.telecallerName} • ${report.date}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF64748B),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.calendar_month_rounded, size: 21, color: Color(0xFF0A5844)),
                  tooltip: 'Select Date',
                  onPressed: _handleSelectDate,
                ),
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0A5844)),
                    ),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 22, color: Color(0xFF64748B)),
                    tooltip: 'Refresh Metrics',
                    onPressed: () => _loadReport(date: _selectedDateStr),
                  ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Scrollable Body
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Hero KPI Summary Cards (2x2 Grid)
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Called Leads',
                          value: '${report.callsMadeToday}',
                          subtitle: 'Connected: ${report.connectedCalls}',
                          icon: Icons.phone_forwarded_rounded,
                          color: const Color(0xFF0A5844),
                          bg: const Color(0xFFECFDF5),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Connection Rate',
                          value: connPct,
                          subtitle: 'Missed: ${report.missedCalls}',
                          icon: Icons.check_circle_outline_rounded,
                          color: const Color(0xFF16A34A),
                          bg: const Color(0xFFF0FDF4),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Orders Booked',
                          value: '${report.convertedOrders}',
                          subtitle: 'Value: ₹${report.convertedOrdersValue.toInt()}',
                          icon: Icons.shopping_bag_outlined,
                          color: const Color(0xFF0284C7),
                          bg: const Color(0xFFF0F9FF),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Average Talk',
                          value: report.avgCallDurationSeconds > 0 ? '${report.avgCallDurationSeconds}s' : '0s',
                          subtitle: 'Follow-ups: ${report.followupsScheduled}',
                          icon: Icons.timer_outlined,
                          color: const Color(0xFF7C3AED),
                          bg: const Color(0xFFF5F3FF),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 22),

                  // Section Title
                  const Text(
                    'Performance Breakdown',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF334155),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // KPI Detailed Breakdown List
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      children: [
                        _buildReportStatRow('Total Leads Assigned Today', '${report.assignedToday} Leads', const Color(0xFF0A5844)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Total Called Leads Today', '${report.callsMadeToday} Leads', const Color(0xFF0F172A)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Connected Calls', '${report.connectedCalls} Calls ($connPct)', const Color(0xFF16A34A)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Missed / Unanswered', '${report.missedCalls} Calls ($missPct)', const Color(0xFFDC2626)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Follow-ups Scheduled', '${report.followupsScheduled} Leads', const Color(0xFFEA580C)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Converted Orders', report.convertedOrdersFormatted, const Color(0xFF0284C7)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Average Call Duration', report.avgCallDurationFormatted, const Color(0xFF475569)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Pending Leads to Call Today', '${report.pendingLeadsToday} Leads', const Color(0xFFD97706)),
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                        _buildReportStatRow('Carryover from Yesterday', '${report.carryoverPendingYesterday} Leads', const Color(0xFF9333EA)),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Bottom Fixed Action Bar
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _isDownloading ? null : _handleDownloadPdf,
                icon: _isDownloading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.download_rounded, color: Colors.white, size: 20),
                label: Text(
                  _isDownloading ? 'Generating Publication PDF...' : 'Download PDF Report',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A5844),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildReportStatRow(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: Color(0xFF475569), fontWeight: FontWeight.w500),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(fontSize: 13.5, color: valueColor, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
