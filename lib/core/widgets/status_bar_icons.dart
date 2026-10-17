import 'package:flutter/material.dart';

/// Custom painter for crisp, vector-rendered cellular signal bars
class SignalBarsPainter extends CustomPainter {
  final Color color;
  final int level; // 1 to 4

  const SignalBarsPainter({
    required this.color,
    this.level = 4,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final barCount = 4;
    final totalSpacing = (barCount - 1) * 1.5;
    final barWidth = (size.width - totalSpacing) / barCount;
    final paintActive = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final paintInactive = Paint()
      ..color = color.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;

    for (int i = 0; i < barCount; i++) {
      final barHeight = size.height * (0.35 + 0.65 * (i / (barCount - 1)));
      final x = i * (barWidth + 1.5);
      final y = size.height - barHeight;
      final rrect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, barWidth, barHeight),
        const Radius.circular(1.0),
      );
      canvas.drawRRect(rrect, i < level ? paintActive : paintInactive);
    }
  }

  @override
  bool shouldRepaint(covariant SignalBarsPainter oldDelegate) =>
      color != oldDelegate.color || level != oldDelegate.level;
}

/// Custom painter for crisp, vector-rendered battery indicator with charge level
class BatteryIconPainter extends CustomPainter {
  final Color color;
  final double level; // 0.0 to 1.0

  const BatteryIconPainter({
    required this.color,
    this.level = 0.85,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Battery body
    final capWidth = 1.8;
    final bodyWidth = size.width - capWidth - 1.5;
    final bodyHeight = size.height;

    final bodyRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0.6, 0.6, bodyWidth, bodyHeight - 1.2),
      const Radius.circular(3.0),
    );
    canvas.drawRRect(bodyRRect, strokePaint);

    // Battery cap (positive terminal)
    final capRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        bodyWidth + 1.2,
        (bodyHeight - 4.5) / 2,
        capWidth,
        4.5,
      ),
      const Radius.circular(1.0),
    );
    canvas.drawRRect(capRRect, fillPaint);

    // Battery fill level inside
    final fillInset = 2.0;
    final maxFillWidth = bodyWidth - fillInset * 2;
    final fillWidth = (maxFillWidth * level).clamp(0.0, maxFillWidth);
    if (fillWidth > 0) {
      final innerRRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          fillInset + 0.6,
          fillInset + 0.6,
          fillWidth,
          bodyHeight - 1.2 - fillInset * 2,
        ),
        const Radius.circular(1.5),
      );
      canvas.drawRRect(innerRRect, fillPaint);
    }
  }

  @override
  bool shouldRepaint(covariant BatteryIconPainter oldDelegate) =>
      color != oldDelegate.color || level != oldDelegate.level;
}

/// Custom painter for crisp, vector-rendered Wi-Fi arcs
class WifiIconPainter extends CustomPainter {
  final Color color;

  const WifiIconPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;

    final center = Offset(size.width / 2, size.height - 1);

    // Draw 2 concentric wifi arcs
    final r1 = size.width * 0.45;
    final r2 = size.width * 0.28;

    final rect1 = Rect.fromCircle(center: center, radius: r1);
    final rect2 = Rect.fromCircle(center: center, radius: r2);

    canvas.drawArc(rect1, -3.14159 * 0.75, 3.14159 * 0.5, false, paint);
    canvas.drawArc(rect2, -3.14159 * 0.75, 3.14159 * 0.5, false, paint);

    // Dot at the bottom
    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(size.width / 2, size.height - 1.8), 1.4, dotPaint);
  }

  @override
  bool shouldRepaint(covariant WifiIconPainter oldDelegate) =>
      color != oldDelegate.color;
}
