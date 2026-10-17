import 'package:flutter/material.dart';

class CurvedTopClipper extends CustomClipper<Path> {
  const CurvedTopClipper();

  @override
  Path getClip(Size size) {
    final path = Path();
    // Start at top-left corner with downward curve
    // The curve bows gently upwards towards center
    path.moveTo(0, 24);
    path.quadraticBezierTo(size.width / 2, -12, size.width, 24);
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
