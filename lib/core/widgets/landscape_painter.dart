import 'package:flutter/material.dart';

class LandscapePainter extends CustomPainter {
  const LandscapePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Horizon starts at 58% of height
    final horizonY = h * 0.58;

    // 1. Sun & Morning Glow
    final sunCenter = Offset(w * 0.66, horizonY - 4);
    final sunRadius = w * 0.085;

    // Soft outer sun glow
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFFFFBE6).withValues(alpha: 0.95),
          const Color(0xFFFFECC0).withValues(alpha: 0.5),
          const Color(0xFFFFF7DB).withValues(alpha: 0.0),
        ],
        stops: const [0.0, 0.45, 1.0],
      ).createShader(Rect.fromCircle(center: sunCenter, radius: sunRadius * 3.2));
    canvas.drawCircle(sunCenter, sunRadius * 3.2, glowPaint);

    // Glowing sun disk
    final sunPaint = Paint()
      ..shader = const RadialGradient(
        colors: [
          Color(0xFFFFFFFF),
          Color(0xFFFFFEEB),
          Color(0xFFFFEEB8),
        ],
      ).createShader(Rect.fromCircle(center: sunCenter, radius: sunRadius));
    canvas.drawCircle(sunCenter, sunRadius, sunPaint);

    // 2. Far Distant Mountains (soft golden amber / misty haze)
    final farHillsPath = Path()
      ..moveTo(0, horizonY + 12)
      ..cubicTo(w * 0.2, horizonY - 14, w * 0.4, horizonY + 8, w * 0.6, horizonY - 26)
      ..cubicTo(w * 0.72, horizonY - 32, w * 0.86, horizonY - 8, w, horizonY + 6)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final farHillsPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFFF7D9A4).withValues(alpha: 0.85),
          const Color(0xFFE8CB92).withValues(alpha: 0.95),
        ],
      ).createShader(Rect.fromLTWH(0, horizonY - 35, w, 80));
    canvas.drawPath(farHillsPath, farHillsPaint);

    // 3. Mid Hills (soft sage & olive green)
    final midHillsPath = Path()
      ..moveTo(0, horizonY + 18)
      ..cubicTo(w * 0.15, horizonY - 2, w * 0.35, horizonY + 24, w * 0.5, horizonY + 6)
      ..cubicTo(w * 0.68, horizonY - 12, w * 0.82, horizonY + 16, w, horizonY + 12)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final midHillsPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF86A870),
          Color(0xFF5E8B4C),
        ],
      ).createShader(Rect.fromLTWH(0, horizonY - 15, w, 90));
    canvas.drawPath(midHillsPath, midHillsPaint);

    // 4. Distant Tree Canopy Silhouettes along the mid ridges
    _drawTreeCluster(canvas, Offset(w * 0.08, horizonY + 14), 16, const Color(0xFF43733A));
    _drawTreeCluster(canvas, Offset(w * 0.22, horizonY + 16), 22, const Color(0xFF386630));
    _drawTreeCluster(canvas, Offset(w * 0.36, horizonY + 22), 18, const Color(0xFF43733A));
    _drawTreeCluster(canvas, Offset(w * 0.52, horizonY + 18), 15, const Color(0xFF4B7940));
    _drawTreeCluster(canvas, Offset(w * 0.72, horizonY + 18), 24, const Color(0xFF35612D));
    _drawTreeCluster(canvas, Offset(w * 0.86, horizonY + 20), 20, const Color(0xFF3D6B35));

    // 5. Near Foothills & Valley Grass
    final nearHillPath = Path()
      ..moveTo(0, horizonY + 36)
      ..cubicTo(w * 0.3, horizonY + 28, w * 0.6, horizonY + 45, w, horizonY + 32)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final nearHillPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF6B9C38),
          Color(0xFF528022),
        ],
      ).createShader(Rect.fromLTWH(0, horizonY + 25, w, 70));
    canvas.drawPath(nearHillPath, nearHillPaint);

    // Mid-ground lush standing trees
    _drawStandingTree(canvas, Offset(w * 0.12, horizonY + 42), 34);
    _drawStandingTree(canvas, Offset(w * 0.25, horizonY + 48), 28);
    _drawStandingTree(canvas, Offset(w * 0.76, horizonY + 44), 32);
    _drawStandingTree(canvas, Offset(w * 0.88, horizonY + 40), 26);

    // 6. Lush Terraced Plantation Crop Rows (radiating perspective lines)
    final terraceStart = horizonY + 45;
    final rowCount = 10;
    for (int i = 0; i < rowCount; i++) {
      final t = i / (rowCount - 1);
      final y0 = terraceStart + t * (h - terraceStart);
      final nextY = terraceStart + ((i + 1) / (rowCount - 1)) * (h - terraceStart);

      final rowPath = Path()
        ..moveTo(0, y0)
        ..cubicTo(w * 0.35, y0 + 12 * (1 - t), w * 0.7, y0 - 8 * (1 - t), w, y0)
        ..lineTo(w, nextY)
        ..cubicTo(w * 0.7, nextY - 8 * (1 - t), w * 0.35, nextY + 12 * (1 - t), 0, nextY)
        ..close();

      // Alternate between sunlit vibrant chartreuse-green and deep emerald shadow
      final isSunlit = i % 2 == 0;
      final rowColor1 = isSunlit
          ? Color.lerp(const Color(0xFF8AA811), const Color(0xFF68A308), t)!
          : Color.lerp(const Color(0xFF4C7B14), const Color(0xFF28560E), t)!;
      final rowColor2 = isSunlit
          ? Color.lerp(const Color(0xFFADC416), const Color(0xFF7CB80C), t)!
          : Color.lerp(const Color(0xFF386411), const Color(0xFF1E430B), t)!;

      final rowPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [rowColor1, rowColor2, rowColor1],
        ).createShader(Rect.fromLTWH(0, y0, w, (nextY - y0).abs() + 2));

      canvas.drawPath(rowPath, rowPaint);
    }
  }

  void _drawTreeCluster(Canvas canvas, Offset center, double radius, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, paint);
    canvas.drawCircle(Offset(center.dx - radius * 0.55, center.dy + radius * 0.2), radius * 0.75, paint);
    canvas.drawCircle(Offset(center.dx + radius * 0.55, center.dy + radius * 0.2), radius * 0.75, paint);
  }

  void _drawStandingTree(Canvas canvas, Offset base, double height) {
    final trunkPaint = Paint()
      ..color = const Color(0xFF27421F)
      ..strokeWidth = height * 0.12
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(base, Offset(base.dx, base.dy - height * 0.45), trunkPaint);

    final canopyCenter = Offset(base.dx, base.dy - height * 0.65);
    final canopyRadius = height * 0.38;

    // Canopy shadow
    final shadowPaint = Paint()..color = const Color(0xFF214E1B);
    canvas.drawCircle(Offset(canopyCenter.dx, canopyCenter.dy + 3), canopyRadius, shadowPaint);

    // Canopy highlight
    final canopyPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.25, -0.35),
        colors: const [
          Color(0xFF56942C),
          Color(0xFF356A18),
        ],
      ).createShader(Rect.fromCircle(center: canopyCenter, radius: canopyRadius));
    canvas.drawCircle(canopyCenter, canopyRadius, canopyPaint);
  }

  @override
  bool shouldRepaint(covariant LandscapePainter oldDelegate) => false;
}
