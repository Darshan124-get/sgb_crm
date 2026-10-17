import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/calls_service.dart';
import '../../domain/models/call_record_model.dart';

class CallDetailsBottomSheet extends StatefulWidget {
  final CallRecordModel call;

  const CallDetailsBottomSheet({
    super.key,
    required this.call,
  });

  static Future<void> show(BuildContext context, CallRecordModel call) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CallDetailsBottomSheet(call: call),
    );
  }

  @override
  State<CallDetailsBottomSheet> createState() => _CallDetailsBottomSheetState();
}

class _CallDetailsBottomSheetState extends State<CallDetailsBottomSheet> {
  AudioPlayer? _player;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _stateSub;
  StreamSubscription? _completeSub;

  @override
  void initState() {
    super.initState();
    if (widget.call.talkTimeSeconds > 0) {
      _duration = Duration(seconds: widget.call.talkTimeSeconds);
    } else if (widget.call.durationSeconds > 0) {
      _duration = Duration(seconds: widget.call.durationSeconds);
    }
  }

  void _initPlayerIfNeeded() {
    if (_player != null) return;
    _player = AudioPlayer();

    _posSub = _player!.onPositionChanged.listen((pos) {
      if (mounted) {
        setState(() => _position = pos);
      }
    });

    _durSub = _player!.onDurationChanged.listen((dur) {
      if (mounted && dur.inMilliseconds > 0) {
        setState(() => _duration = dur);
      }
    });

    _stateSub = _player!.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() => _isPlaying = state == PlayerState.playing);
      }
    });

    _completeSub = _player!.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _isPlaying = false;
          _position = Duration.zero;
        });
      }
    });
  }

  Future<void> _togglePlayPause() async {
    final streamUrl = widget.call.audioStreamUrl;
    if (streamUrl == null || streamUrl.isEmpty) return;

    _initPlayerIfNeeded();

    try {
      if (_isPlaying) {
        await _player!.pause();
      } else {
        if (_position > Duration.zero && _position < _duration) {
          await _player!.resume();
        } else {
          await _player!.play(UrlSource(streamUrl));
        }
      }
    } catch (e) {
      debugPrint('Error playing audio stream: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot stream audio: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _completeSub?.cancel();
    _player?.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  void _callBack() {
    Navigator.pop(context);
    CallsService.dialCustomer(
      context,
      phone: widget.call.customerPhone,
      leadId: widget.call.leadId,
      leadName: widget.call.leadName,
    );
  }

  void _copyPhone() {
    Clipboard.setData(ClipboardData(text: widget.call.customerPhone));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Phone number copied to clipboard'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final call = widget.call;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag Handle Bar
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Top Header: Title, Direction, Status Pill
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: call.isOutbound ? const Color(0xFFDCFCE7) : const Color(0xFFE0E7FF),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    call.isOutbound ? Icons.call_made_rounded : Icons.call_received_rounded,
                    color: call.isOutbound ? const Color(0xFF047857) : const Color(0xFF4338CA),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        call.customerPhone,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      if (call.leadName != null && call.leadName!.isNotEmpty) ...[
                        Text(
                          call.leadName!,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0A5844),
                          ),
                        ),
                      ] else ...[
                        Text(
                          call.isOutbound ? 'Outgoing Call' : 'Incoming Call',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: call.statusBgColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: call.statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        call.statusLabel,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: call.statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),

            // Metrics Container Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildDetailRow(
                    label: 'Telecaller',
                    value: call.crmUserName ?? 'System / Queued',
                    icon: Icons.person_outline_rounded,
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E8F0)),
                  _buildDetailRow(
                    label: 'Talk Time / Total Duration',
                    value: '${call.formattedTalkTime} / ${call.formattedDuration}',
                    icon: Icons.timer_outlined,
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E8F0)),
                  _buildDetailRow(
                    label: 'DID (Caller ID)',
                    value: call.didNumber ?? '--',
                    icon: Icons.dialpad_rounded,
                  ),
                  const Divider(height: 16, color: Color(0xFFE2E8F0)),
                  _buildDetailRow(
                    label: 'Hangup Cause',
                    value: call.hangupReason ?? 'Normal Clearing',
                    icon: Icons.call_end_outlined,
                  ),
                  if (call.leadId != null && call.leadId!.isNotEmpty) ...[
                    const Divider(height: 16, color: Color(0xFFE2E8F0)),
                    _buildDetailRow(
                      label: 'CRM Lead Reference',
                      value: '#${call.leadId}',
                      icon: Icons.badge_outlined,
                      valueColor: const Color(0xFF2563EB),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Audio Player Section
            if (call.hasAudio) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Row(
                            children: [
                              Icon(Icons.mic_rounded, size: 16, color: Color(0xFF047857)),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Call Audio Recording',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF047857),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Cloudflare R2',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF047857),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        GestureDetector(
                          onTap: _togglePlayPause,
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: const BoxDecoration(
                              color: Color(0xFF0A5844),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  trackHeight: 4,
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                                  activeTrackColor: const Color(0xFF0A5844),
                                  inactiveTrackColor: const Color(0xFFCBD5E1),
                                  thumbColor: const Color(0xFF0A5844),
                                ),
                                child: Slider(
                                  value: _position.inMilliseconds.clamp(0, _duration.inMilliseconds).toDouble(),
                                  max: _duration.inMilliseconds > 0 ? _duration.inMilliseconds.toDouble() : 1.0,
                                  onChanged: (val) async {
                                    final newPos = Duration(milliseconds: val.toInt());
                                    await _player?.seek(newPos);
                                    setState(() => _position = newPos);
                                  },
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 6),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _formatDuration(_position),
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                    ),
                                    Text(
                                      _formatDuration(_duration),
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _callBack,
                    icon: const Icon(Icons.phone_rounded, size: 20),
                    label: const Text('Call Back'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: _copyPhone,
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: const Text('Copy'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF475569),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow({
    required String label,
    required String value,
    required IconData icon,
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 8),
        Expanded(
          flex: 5,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 6,
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: valueColor ?? const Color(0xFF0F172A),
            ),
          ),
        ),
      ],
    );
  }
}
