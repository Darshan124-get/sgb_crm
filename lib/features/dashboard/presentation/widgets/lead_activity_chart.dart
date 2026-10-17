import 'package:flutter/material.dart';
import '../../domain/models/dashboard_data.dart';

class LeadActivityChart extends StatefulWidget {
  final List<ChartPoint> points;
  final String activeFilter;
  final ValueChanged<String> onFilterChanged;

  const LeadActivityChart({
    super.key,
    required this.points,
    this.activeFilter = 'Day',
    required this.onFilterChanged,
  });

  @override
  State<LeadActivityChart> createState() => _LeadActivityChartState();
}

class _LeadActivityChartState extends State<LeadActivityChart>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _chartProgress;
  int? _hoveredIndex;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _chartProgress = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    );

    _animController.forward();
  }

  @override
  void didUpdateWidget(covariant LeadActivityChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.activeFilter != widget.activeFilter || oldWidget.points != widget.points) {
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFF1F5F9),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.035),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Title & Day/Week/Month Filter
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.bar_chart_rounded,
                    color: Color(0xFF0A5844),
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Lead Activity Trend',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              ),

              // Filter Tabs
              Container(
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildFilterPill('Day'),
                    _buildFilterPill('Week'),
                    _buildFilterPill('Month'),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          // Chart Canvas
          SizedBox(
            height: 190,
            width: double.infinity,
            child: AnimatedBuilder(
              animation: _chartProgress,
              builder: (context, child) {
                return LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      onTapDown: (details) {
                        final width = constraints.maxWidth - 34; // subtracting y-axis
                        final step = width / (widget.points.length - 1);
                        final localX = details.localPosition.dx - 34;
                        if (localX >= 0 && localX <= width) {
                          final idx = (localX / step).round();
                          setState(() {
                            _hoveredIndex = idx.clamp(0, widget.points.length - 1);
                          });
                        }
                      },
                      child: CustomPaint(
                        size: Size(constraints.maxWidth, 190),
                        painter: _ActivityChartPainter(
                          points: widget.points,
                          progress: _chartProgress.value,
                          hoveredIndex: _hoveredIndex,
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),

          const SizedBox(height: 14),

          // Legend
          Wrap(
            spacing: 16,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: const [
              _LegendItem(color: Color(0xFF2563EB), label: 'Leads Assigned'),
              _LegendItem(color: Color(0xFF10B981), label: 'Called'),
              _LegendItem(color: Color(0xFF9333EA), label: 'Connected'),
              _LegendItem(color: Color(0xFFF97316), label: 'Sold'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String label) {
    final isSelected = widget.activeFilter.toLowerCase() == label.toLowerCase();

    return GestureDetector(
      onTap: () => widget.onFilterChanged(label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0A5844) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF64748B),
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _ActivityChartPainter extends CustomPainter {
  final List<ChartPoint> points;
  final double progress;
  final int? hoveredIndex;

  _ActivityChartPainter({
    required this.points,
    required this.progress,
    this.hoveredIndex,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const leftMargin = 32.0;
    const bottomMargin = 22.0;
    const topMargin = 10.0;

    final chartWidth = size.width - leftMargin;
    final chartHeight = size.height - bottomMargin - topMargin;

    double maxDataVal = 4.0;
    for (final p in points) {
      if (p.assigned > maxDataVal) maxDataVal = p.assigned;
      if (p.called > maxDataVal) maxDataVal = p.called;
      if (p.connected > maxDataVal) maxDataVal = p.connected;
      if (p.sold > maxDataVal) maxDataVal = p.sold;
    }
    final maxY = (maxDataVal <= 4)
        ? 4.0
        : (maxDataVal <= 8)
            ? 8.0
            : (maxDataVal <= 16)
                ? 16.0
                : (maxDataVal <= 40)
                    ? 40.0
                    : ((maxDataVal / 20).ceil() * 20.0);

    // 1. Draw Y-Axis Labels & Gridlines
    final gridPaint = Paint()
      ..color = const Color(0xFFF1F5F9)
      ..strokeWidth = 1.0;

    final yValues = [
      maxY.toInt(),
      (maxY * 0.75).round(),
      (maxY * 0.50).round(),
      (maxY * 0.25).round(),
      0
    ];
    for (final yVal in yValues) {
      final yRatio = yVal / maxY;
      final yPos = topMargin + chartHeight * (1.0 - yRatio);

      // Grid line
      canvas.drawLine(
        Offset(leftMargin, yPos),
        Offset(size.width, yPos),
        gridPaint,
      );

      // Y Label
      final textPainter = TextPainter(
        text: TextSpan(
          text: '$yVal',
          style: const TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      textPainter.paint(
        canvas,
        Offset(leftMargin - textPainter.width - 6, yPos - textPainter.height / 2),
      );
    }

    if (points.isEmpty) return;

    final dx = chartWidth / (points.length - 1);

    // 2. Draw X-Axis Labels
    for (int i = 0; i < points.length; i++) {
      final xPos = leftMargin + i * dx;
      final textPainter = TextPainter(
        text: TextSpan(
          text: points[i].label,
          style: TextStyle(
            color: hoveredIndex == i
                ? const Color(0xFF0F172A)
                : const Color(0xFF94A3B8),
            fontSize: 9.5,
            fontWeight: hoveredIndex == i ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      textPainter.paint(
        canvas,
        Offset(xPos - textPainter.width / 2, size.height - bottomMargin + 6),
      );
    }

    // Series Definitions
    final series = [
      _Series(color: const Color(0xFF2563EB), values: points.map((p) => p.assigned).toList()),
      _Series(color: const Color(0xFF10B981), values: points.map((p) => p.called).toList()),
      _Series(color: const Color(0xFF9333EA), values: points.map((p) => p.connected).toList()),
      _Series(color: const Color(0xFFF97316), values: points.map((p) => p.sold).toList()),
    ];

    // 3. Draw Curves & Data Dots
    for (final s in series) {
      final linePaint = Paint()
        ..color = s.color
        ..strokeWidth = 2.4
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

      final path = Path();
      final offsets = <Offset>[];

      for (int i = 0; i < s.values.length; i++) {
        final x = leftMargin + i * dx;
        final animatedVal = s.values[i] * progress;
        final y = topMargin + chartHeight * (1.0 - (animatedVal / maxY));
        offsets.add(Offset(x, y));
      }

      // Smooth Bezier Curve Path
      path.moveTo(offsets[0].dx, offsets[0].dy);
      for (int i = 0; i < offsets.length - 1; i++) {
        final p0 = offsets[i];
        final p1 = offsets[i + 1];
        final midX = (p0.dx + p1.dx) / 2;
        path.cubicTo(midX, p0.dy, midX, p1.dy, p1.dx, p1.dy);
      }

      canvas.drawPath(path, linePaint);

      // Data Points
      final dotPaint = Paint()..color = s.color;
      final dotCenterPaint = Paint()..color = Colors.white;

      for (int i = 0; i < offsets.length; i++) {
        final p = offsets[i];
        final isHovered = hoveredIndex == i;
        canvas.drawCircle(p, isHovered ? 4.5 : 3.2, dotPaint);
        canvas.drawCircle(p, isHovered ? 2.5 : 1.6, dotCenterPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ActivityChartPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.hoveredIndex != hoveredIndex;
  }
}

class _Series {
  final Color color;
  final List<double> values;
  const _Series({required this.color, required this.values});
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
