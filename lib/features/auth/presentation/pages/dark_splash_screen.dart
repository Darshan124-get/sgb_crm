import 'package:flutter/material.dart';
import '../../../../core/constants/dark_splash_colors.dart';

class DarkSplashScreen extends StatefulWidget {
  final VoidCallback? onAnimationFinished;

  const DarkSplashScreen({
    super.key,
    this.onAnimationFinished,
  });

  @override
  State<DarkSplashScreen> createState() => _DarkSplashScreenState();
}

class _DarkSplashScreenState extends State<DarkSplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoGlow;
  late final Animation<double> _textFade;
  late final Animation<Offset> _textSlide;
  late final Animation<double> _sloganFade;
  late final Animation<Offset> _sloganSlide;
  late final Animation<Offset> _waveSlide;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    // 1. Logo smooth entrance with bounce
    _logoScale = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.0, 0.55, curve: Curves.easeOutBack),
    );

    // 2. Logo glow breathing
    _logoGlow = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.15, 0.65, curve: Curves.easeOut),
      ),
    );

    // 3. Brand Title "SGB Connect" entrance
    _textFade = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.35, 0.75, curve: Curves.easeOut),
    );

    _textSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.25),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.35, 0.75, curve: Curves.easeOutCubic),
      ),
    );

    // 4. Slogan "Smart Calling / Stronger Business" entrance
    _sloganFade = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.55, 0.95, curve: Curves.easeOut),
    );

    _sloganSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.55, 0.95, curve: Curves.easeOutCubic),
      ),
    );

    // 5. Bottom wave entrance
    _waveSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.2),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.2, 0.85, curve: Curves.easeOutCubic),
      ),
    );

    _animController.forward().whenComplete(() {
      widget.onAnimationFinished?.call();
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: DarkSplashColors.background,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Deep Black Background with Radial Spotlight Glow Behind Logo
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0.0, -0.35),
                  radius: 0.85,
                  colors: [
                    DarkSplashColors.radialGlow,
                    Color(0xFF0F1014),
                    DarkSplashColors.background,
                  ],
                  stops: [0.0, 0.45, 1.0],
                ),
              ),
            ),
          ),

          // 2. High-Definition 3D Satin Silk Waves at the Bottom (Blue & Red)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SlideTransition(
              position: _waveSlide,
              child: SizedBox(
                width: size.width,
                height: size.height * 0.44,
                child: Image.asset(
                  'assets/images/dark_splash_waves_hd.png',
                  fit: BoxFit.cover,
                  alignment: Alignment.bottomCenter,
                  filterQuality: FilterQuality.high,
                ),
              ),
            ),
          ),

          // 3. Central Brand Content (Logo, Title, Slogan)
          Positioned.fill(
            child: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // 3D Metallic SGB Gear Logo with Animated Glow
                      ScaleTransition(
                        scale: _logoScale,
                        child: AnimatedBuilder(
                          animation: _logoGlow,
                          builder: (context, child) {
                            return Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF005AFF).withValues(
                                      alpha: 0.28 * _logoGlow.value,
                                    ),
                                    blurRadius: 36,
                                    spreadRadius: 2,
                                  ),
                                  BoxShadow(
                                    color: const Color(0xFFE50914).withValues(
                                      alpha: 0.22 * _logoGlow.value,
                                    ),
                                    blurRadius: 40,
                                    offset: const Offset(4, 10),
                                  ),
                                ],
                              ),
                              child: child,
                            );
                          },
                          child: Image.asset(
                            'assets/icons/icon.png',
                            width: 140,
                            height: 140,
                            fit: BoxFit.contain,
                            filterQuality: FilterQuality.high,
                          ),
                        ),
                      ),

                      const SizedBox(height: 28),

                      // Brand Name "SGB Connect" (Blue "SGB" + White "Connect")
                      SlideTransition(
                        position: _textSlide,
                        child: FadeTransition(
                          opacity: _textFade,
                          child: RichText(
                            textAlign: TextAlign.center,
                            text: const TextSpan(
                              children: [
                                TextSpan(
                                  text: 'SGB ',
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.4,
                                    color: DarkSplashColors.brandBlue,
                                    shadows: [
                                      Shadow(
                                        color: Color(0x66005AFF),
                                        blurRadius: 16,
                                      ),
                                    ],
                                  ),
                                ),
                                TextSpan(
                                  text: 'Connect',
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.2,
                                    color: DarkSplashColors.brandWhite,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 18),

                      // Slogan: "Smart Calling / Stronger Business"
                      SlideTransition(
                        position: _sloganSlide,
                        child: FadeTransition(
                          opacity: _sloganFade,
                          child: const Column(
                            children: [
                              Text(
                                'Smart Calling',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.2,
                                  color: DarkSplashColors.sloganPrimary,
                                  height: 1.3,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Stronger Business',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.2,
                                  color: DarkSplashColors.sloganSecondary,
                                  height: 1.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
