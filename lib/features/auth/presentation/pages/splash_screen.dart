import 'package:flutter/material.dart';
import 'dark_splash_screen.dart';

class SplashScreen extends StatelessWidget {
  final VoidCallback? onGetStarted;

  const SplashScreen({
    super.key,
    this.onGetStarted,
  });

  @override
  Widget build(BuildContext context) {
    return DarkSplashScreen(
      onAnimationFinished: onGetStarted,
    );
  }
}
