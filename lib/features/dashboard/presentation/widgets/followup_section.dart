import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../domain/models/dashboard_data.dart';

class FollowupSection extends StatefulWidget {
  final List<FollowUpBarData> trends;
  final List<FollowUpBarData>? dayTrends;
  final List<FollowUpBarData>? weekTrends;
  final List<FollowUpBarData>? monthTrends;
  final List<OutcomeSegment> outcomes;
  final int totalFollowUps;

  const FollowupSection({
    super.key,
    required this.trends,
    this.dayTrends,
    this.weekTrends,
    this.monthTrends,
    required this.outcomes,
    required this.totalFollowUps,
  });

  @override
  State<FollowupSection> createState() => _FollowupSectionState();
}

class _FollowupSectionState extends State<FollowupSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _progress;

  String _trendFilter = 'Day';
  String _outcomeFilter = 'Day';

  List<FollowUpBarData> _getCurrentTrends() {
    if (_trendFilter == 'Week') return widget.weekTrends ?? widget.trends;
    if (_trendFilter == 'Month') return widget.monthTrends ?? widget.trends;
    return widget.dayTrends ?? widget.trends;
  }

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _progress = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    );
    _animController.forward();
  }

  @override
  void didUpdateWidget(covariant FollowupSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.trends != widget.trends ||
        oldWidget.dayTrends != widget.dayTrends ||
        oldWidget.weekTrends != widget.weekTrends ||
        oldWidget.monthTrends != widget.monthTrends ||
        oldWidget.outcomes != widget.outcomes ||
        oldWidget.totalFollowUps != widget.totalFollowUps) {
      _animController.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 600;

        if (isNarrow) {
          return Column(
            children: [
              _buildTrendCard(),
              const SizedBox(height: 12),
              _buildOutcomesCard(),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildTrendCard()),
            const SizedBox(width: 12),
            Expanded(child: _buildOutcomesCard()),
          ],
        );
      },
    );
  }

  // 1. Follow-up Trend (Grouped Bar Chart)
  Widget _buildTrendCard() {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.035),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Wrap for responsive fit
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 4,
            runSpacing: 6,
            children: [
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.calendar_today_rounded,
                    color: Color(0xFF0A5844),
                    size: 14,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Follow-up Trend',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              _buildMiniFilter(
                active: _trendFilter,
                onChanged: (val) {
                  setState(() => _trendFilter = val);
                  _animController.forward(from: 0.0);
                },
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Bar Chart Canvas
          SizedBox(
            height: 125,
            child: AnimatedBuilder(
              animation: _progress,
              builder: (context, child) {
                return CustomPaint(
                  size: const Size(double.infinity, 125),
                  painter: _BarChartPainter(
                    data: _getCurrentTrends(),
                    progress: _progress.value,
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 10),

          // Legend with Wrap
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: const [
              _MiniLegend(color: Color(0xFF10B981), label: 'Created'),
              _MiniLegend(color: Color(0xFF9333EA), label: 'Converted'),
            ],
          ),
        ],
      ),
    );
  }

  // 2. Follow-up Outcomes (Donut Chart + Breakdown)
  Widget _buildOutcomesCard() {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.035),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Wrap for responsive fit
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 4,
            runSpacing: 6,
            children: [
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.access_time_filled_rounded,
                    color: Color(0xFF0A5844),
                    size: 14,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Follow-up Outcomes',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              _buildMiniFilter(
                active: _outcomeFilter,
                onChanged: (val) => setState(() => _outcomeFilter = val),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Donut Chart + Legend Row
          Row(
            children: [
              // Donut with Center Text
              SizedBox(
                width: 90,
                height: 90,
                child: AnimatedBuilder(
                  animation: _progress,
                  builder: (context, child) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          size: const Size(90, 90),
                          painter: _DonutChartPainter(
                            segments: widget.outcomes,
                            progress: _progress.value,
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${widget.totalFollowUps}',
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                height: 1,
                              ),
                            ),
                            const Text(
                              'Total\nFollow-ups',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 7.5,
                                fontWeight: FontWeight.w500,
                                height: 1.1,
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ),

              const SizedBox(width: 10),

              // Outcomes Breakdown
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: widget.outcomes.map((item) {
                    final percentStr = (item.percentage * 100).toInt();
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2.2),
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: item.color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              item.label,
                              style: const TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          Text(
                            '${item.count} ($percentStr%)',
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildMiniFilter({
    required String active,
    required ValueChanged<String> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: ['Day', 'Week', 'Month'].map((tab) {
          final isSel = active == tab;
          return GestureDetector(
            onTap: () => onChanged(tab),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
              decoration: BoxDecoration(
                color: isSel ? const Color(0xFF0A5844) : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                tab,
                style: TextStyle(
                  color: isSel ? Colors.white : const Color(0xFF64748B),
                  fontSize: 9,
                  fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<FollowUpBarData> data;
  final double progress;

  _BarChartPainter({required this.data, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    const bottomMargin = 18.0;
    const topMargin = 6.0;
    final chartHeight = size.height - bottomMargin - topMargin;

    double calculatedMax = 3.0;
    for (final d in data) {
      if (d.created > calculatedMax) calculatedMax = d.created;
      if (d.converted > calculatedMax) calculatedMax = d.converted;
    }
    final maxVal = (calculatedMax <= 3)
        ? 3.0
        : (calculatedMax <= 6)
            ? 6.0
            : (calculatedMax <= 12)
                ? 12.0
                : (calculatedMax <= 30)
                    ? 30.0
                    : ((calculatedMax / 10).ceil() * 10.0);

    final groupWidth = size.width / data.length;
    final barWidth = (groupWidth * 0.32).clamp(4.0, 9.0);

    final greenPaint = Paint()..color = const Color(0xFF10B981);
    final purplePaint = Paint()..color = const Color(0xFF9333EA);

    // Subtle horizontal baseline
    final linePaint = Paint()
      ..color = const Color(0xFFF1F5F9)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(0, size.height - bottomMargin),
      Offset(size.width, size.height - bottomMargin),
      linePaint,
    );

    for (int i = 0; i < data.length; i++) {
      final item = data[i];
      final groupCenterX = i * groupWidth + groupWidth / 2;

      // Created Bar (Green)
      final createdHeight = (item.created / maxVal) * chartHeight * progress;
      final createdRect = RRect.fromRectAndCorners(
        Rect.fromLTWH(
          groupCenterX - barWidth - 1.5,
          size.height - bottomMargin - createdHeight,
          barWidth,
          createdHeight,
        ),
        topLeft: const Radius.circular(3),
        topRight: const Radius.circular(3),
      );
      canvas.drawRRect(createdRect, greenPaint);

      // Converted Bar (Purple)
      final convertedHeight = (item.converted / maxVal) * chartHeight * progress;
      final convertedRect = RRect.fromRectAndCorners(
        Rect.fromLTWH(
          groupCenterX + 1.5,
          size.height - bottomMargin - convertedHeight,
          barWidth,
          convertedHeight,
        ),
        topLeft: const Radius.circular(3),
        topRight: const Radius.circular(3),
      );
      canvas.drawRRect(convertedRect, purplePaint);

      // X Label
      final textPainter = TextPainter(
        text: TextSpan(
          text: item.time,
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 8.5,
            fontWeight: FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      textPainter.paint(
        canvas,
        Offset(groupCenterX - textPainter.width / 2, size.height - bottomMargin + 4),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

class _DonutChartPainter extends CustomPainter {
  final List<OutcomeSegment> segments;
  final double progress;

  _DonutChartPainter({required this.segments, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 14.0;

    double startAngle = -math.pi / 2;

    for (final seg in segments) {
      final sweepAngle = seg.percentage * 2 * math.pi * progress;
      final paint = Paint()
        ..color = seg.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius - strokeWidth / 2),
        startAngle,
        sweepAngle,
        false,
        paint,
      );

      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutChartPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

class _MiniLegend extends StatelessWidget {
  final Color color;
  final String label;

  const _MiniLegend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 9,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
