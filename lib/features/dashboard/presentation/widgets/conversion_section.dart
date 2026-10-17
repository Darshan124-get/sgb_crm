import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../domain/models/dashboard_data.dart';

class ConversionSection extends StatefulWidget {
  final List<TimelineProgressItem> timelineItems;
  final double conversionRate;
  final int totalFollowUps;
  final int convertedFollowUps;
  final double avgDaysToConvert;

  const ConversionSection({
    super.key,
    required this.timelineItems,
    required this.conversionRate,
    required this.totalFollowUps,
    required this.convertedFollowUps,
    required this.avgDaysToConvert,
  });

  @override
  State<ConversionSection> createState() => _ConversionSectionState();
}

class _ConversionSectionState extends State<ConversionSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _progress;
  String _rateFilter = 'Day';

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
              _buildTimelineCard(),
              const SizedBox(height: 12),
              _buildRateCard(),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildTimelineCard()),
            const SizedBox(width: 12),
            Expanded(child: _buildRateCard()),
          ],
        );
      },
    );
  }

  // 1. Conversion Timeline Card
  Widget _buildTimelineCard() {
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
          const Row(
            children: [
              Icon(
                Icons.access_time_rounded,
                color: Color(0xFF0A5844),
                size: 15,
              ),
              SizedBox(width: 5),
              Text(
                'Conversion Timeline',
                style: TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          const Text(
            'Days taken to convert (from follow-up)',
            style: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 9.5,
              fontWeight: FontWeight.w400,
            ),
          ),

          const SizedBox(height: 14),

          // Horizontal Progress Bars
          AnimatedBuilder(
            animation: _progress,
            builder: (context, child) {
              return Column(
                children: widget.timelineItems.map((item) {
                  final percentStr = (item.percentage * 100).toInt();
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 54,
                          child: Text(
                            item.duration,
                            style: const TextStyle(
                              color: Color(0xFF475569),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              height: 10,
                              color: const Color(0xFFF1F5F9),
                              alignment: Alignment.centerLeft,
                              child: FractionallySizedBox(
                                widthFactor: (item.percentage * _progress.value).clamp(0.0, 1.0),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: item.color,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 26,
                          child: Text(
                            '$percentStr%',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  // 2. Follow-up Conversion Rate Card
  Widget _buildRateCard() {
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
                    Icons.track_changes_rounded,
                    color: Color(0xFF0A5844),
                    size: 14,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Follow-up Conversion Rate',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              _buildMiniFilter(
                active: _rateFilter,
                onChanged: (val) => setState(() => _rateFilter = val),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Radial Gauge
              SizedBox(
                width: 82,
                height: 82,
                child: AnimatedBuilder(
                  animation: _progress,
                  builder: (context, child) {
                    final percent = (widget.conversionRate * 100).toInt();
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          size: const Size(82, 82),
                          painter: _GaugePainter(
                            percentage: widget.conversionRate * _progress.value,
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$percent%',
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                height: 1,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Follow-up to\nSale Conversion',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 7,
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

              // Stats Summary
              Expanded(
                child: Column(
                  children: [
                    _buildStatRow('Total Follow-ups', '${widget.totalFollowUps}'),
                    const Divider(height: 8, color: Color(0xFFF1F5F9)),
                    _buildStatRow('Converted', '${widget.convertedFollowUps}'),
                    const Divider(height: 8, color: Color(0xFFF1F5F9)),
                    _buildStatRow('Avg. Days to Convert', '${widget.avgDaysToConvert}'),
                    const Divider(height: 8, color: Color(0xFFF1F5F9)),
                    _buildStatRow('Conversion Rate', '${(widget.conversionRate * 100).toInt()}%'),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 9.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFF0F172A),
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
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

class _GaugePainter extends CustomPainter {
  final double percentage;

  _GaugePainter({required this.percentage});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 10.0;

    // Background track
    final bgPaint = Paint()
      ..color = const Color(0xFFF1F5F9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    canvas.drawCircle(center, radius - strokeWidth / 2, bgPaint);

    // Active Green Arc
    final activePaint = Paint()
      ..color = const Color(0xFF0A5844)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final sweepAngle = percentage * 2 * math.pi;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius - strokeWidth / 2),
      -math.pi / 2,
      sweepAngle,
      false,
      activePaint,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter oldDelegate) {
    return oldDelegate.percentage != percentage;
  }
}
