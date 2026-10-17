import 'package:flutter/material.dart';

/// Centralized Shimmer Loading animation scope for SGB Connect.
class ShimmerLoadingScope extends StatefulWidget {
  final Widget child;

  const ShimmerLoadingScope({super.key, required this.child});

  static ShimmerLoadingScopeState? of(BuildContext context) {
    return context.findAncestorStateOfType<ShimmerLoadingScopeState>();
  }

  @override
  State<ShimmerLoadingScope> createState() => ShimmerLoadingScopeState();
}

class ShimmerLoadingScopeState extends State<ShimmerLoadingScope>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Animation<double> get animation => _shimmerController;

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

/// Generic Shimmer Box element used to construct skeleton layouts
class ShimmerBox extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;
  final BoxShape shape;
  final Color baseColor;
  final Color highlightColor;

  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
    this.shape = BoxShape.rectangle,
    this.baseColor = const Color(0xFFE2E8F0),
    this.highlightColor = const Color(0xFFF8FAFC),
  });

  const ShimmerBox.dark({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
    this.shape = BoxShape.rectangle,
    this.baseColor = const Color(0xFF064736),
    this.highlightColor = const Color(0xFF0F5A47),
  });

  const ShimmerBox.circle({
    super.key,
    required double size,
    this.baseColor = const Color(0xFFE2E8F0),
    this.highlightColor = const Color(0xFFF8FAFC),
  })  : width = size,
        height = size,
        borderRadius = 0,
        shape = BoxShape.circle;

  const ShimmerBox.darkCircle({
    super.key,
    required double size,
    this.baseColor = const Color(0xFF064736),
    this.highlightColor = const Color(0xFF0F5A47),
  })  : width = size,
        height = size,
        borderRadius = 0,
        shape = BoxShape.circle;

  @override
  Widget build(BuildContext context) {
    final scope = ShimmerLoadingScope.of(context);
    final anim = scope?.animation;

    Widget buildBox(double progress) {
      return Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          shape: shape,
          borderRadius: shape == BoxShape.circle ? null : BorderRadius.circular(borderRadius),
          gradient: LinearGradient(
            begin: Alignment(-1.5 + (progress * 3.0), -0.3),
            end: Alignment(0.5 + (progress * 3.0), 0.3),
            colors: [
              baseColor,
              highlightColor,
              baseColor,
            ],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
      );
    }

    if (anim != null) {
      return AnimatedBuilder(
        animation: anim,
        builder: (context, child) => buildBox(anim.value),
      );
    }

    return buildBox(0.5);
  }
}
