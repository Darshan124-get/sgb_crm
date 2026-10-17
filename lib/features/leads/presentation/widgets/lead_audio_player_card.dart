import 'dart:async';
import 'package:flutter/material.dart';

class LeadAudioPlayerCard extends StatefulWidget {
  final String durationText;
  final List<double> waveformPoints;
  final VoidCallback? onMorePressed;

  const LeadAudioPlayerCard({
    super.key,
    required this.durationText,
    required this.waveformPoints,
    this.onMorePressed,
  });

  @override
  State<LeadAudioPlayerCard> createState() => _LeadAudioPlayerCardState();
}

class _LeadAudioPlayerCardState extends State<LeadAudioPlayerCard>
    with SingleTickerProviderStateMixin {
  bool _isPlaying = false;
  double _playbackProgress = 0.0;
  int _elapsedSeconds = 0;
  Timer? _playbackTimer;
  late final AnimationController _waveAnimController;

  @override
  void initState() {
    super.initState();
    _waveAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _playbackTimer?.cancel();
    _waveAnimController.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    setState(() {
      _isPlaying = !_isPlaying;
    });

    if (_isPlaying) {
      _waveAnimController.repeat(reverse: true);
      _playbackTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
        if (!mounted) return;
        setState(() {
          _playbackProgress += 0.02;
          if (_playbackProgress >= 1.0) {
            _playbackProgress = 0.0;
            _elapsedSeconds = 0;
            _isPlaying = false;
            _waveAnimController.stop();
            timer.cancel();
          } else {
            _elapsedSeconds = (_playbackProgress * 252).toInt(); // 04:12 = 252s
          }
        });
      });
    } else {
      _waveAnimController.stop();
      _playbackTimer?.cancel();
    }
  }

  String _formatElapsed() {
    final m = (_elapsedSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (_elapsedSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Play/Pause Circle
              GestureDetector(
                onTap: _togglePlayPause,
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFF0A5844),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Icon(
                      _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 12),

              // Audio Waveform Visualizer
              Expanded(
                child: AnimatedBuilder(
                  animation: _waveAnimController,
                  builder: (context, child) {
                    return CustomPaint(
                      size: const Size(double.infinity, 30),
                      painter: _WaveformPainter(
                        amplitudes: widget.waveformPoints.isEmpty
                            ? const [
                                0.3, 0.6, 0.9, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.4,
                                0.8, 0.6, 0.4, 0.7, 0.9, 0.5, 0.3, 0.8, 0.6, 0.4
                              ]
                            : widget.waveformPoints,
                        progress: _playbackProgress,
                        animValue: _isPlaying ? _waveAnimController.value : 0.0,
                        playedColor: const Color(0xFF0A5844),
                        unplayedColor: const Color(0xFFCBD5E1),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(width: 10),

              // Overflow Menu
              GestureDetector(
                onTap: widget.onMorePressed ??
                    () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Audio options: Speed 1x • Download recording'),
                          behavior: SnackBarBehavior.floating,
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                child: const Padding(
                  padding: EdgeInsets.all(4.0),
                  child: Icon(
                    Icons.more_horiz_rounded,
                    color: Color(0xFF64748B),
                    size: 20,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Timestamps Row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 50.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _formatElapsed(),
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  widget.durationText,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WaveformPainter extends CustomPainter {
  final List<double> amplitudes;
  final double progress;
  final double animValue;
  final Color playedColor;
  final Color unplayedColor;

  _WaveformPainter({
    required this.amplitudes,
    required this.progress,
    required this.animValue,
    required this.playedColor,
    required this.unplayedColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (amplitudes.isEmpty) return;

    final barWidth = 2.5;
    final totalBars = amplitudes.length;
    final availableSpacing = (size.width - (totalBars * barWidth)) / (totalBars - 1);
    final spacing = availableSpacing > 1.0 ? availableSpacing : 1.5;

    final playedPaint = Paint()
      ..color = playedColor
      ..strokeCap = StrokeCap.round
      ..strokeWidth = barWidth;

    final unplayedPaint = Paint()
      ..color = unplayedColor
      ..strokeCap = StrokeCap.round
      ..strokeWidth = barWidth;

    final currentPlayedX = size.width * progress;

    for (int i = 0; i < totalBars; i++) {
      final x = i * (barWidth + spacing) + (barWidth / 2);
      if (x > size.width) break;

      double amp = amplitudes[i];
      // Subtle equalizer pulse when active
      if (animValue > 0) {
        final variance = ((i % 3) == 0 ? 0.15 : -0.1) * animValue;
        amp = (amp + variance).clamp(0.15, 1.0);
      }

      final barHeight = amp * size.height;
      final yTop = (size.height - barHeight) / 2;
      final yBottom = yTop + barHeight;

      final paint = x <= currentPlayedX ? playedPaint : unplayedPaint;
      canvas.drawLine(Offset(x, yTop), Offset(x, yBottom), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.animValue != animValue;
  }
}
