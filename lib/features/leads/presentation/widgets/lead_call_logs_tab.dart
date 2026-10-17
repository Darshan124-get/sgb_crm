import 'package:flutter/material.dart';
import '../../domain/models/lead_detail_model.dart';
import 'lead_audio_player_card.dart';

class LeadCallLogsTab extends StatelessWidget {
  final LeadDetailModel detail;

  const LeadCallLogsTab({super.key, required this.detail});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.04),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    'All Call Recordings & Logs',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${detail.calls.length} Total Calls',
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...detail.calls.map((call) {
              return Column(
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: call.iconBgColor,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(call.iconData, color: call.iconColor, size: 22),
                    ),
                    title: Text(
                      call.typeLabel,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    subtitle: Text(
                      '${call.statusSubtitle} • ${call.timeText}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    trailing: const Icon(Icons.more_vert_rounded, size: 20, color: Color(0xFF94A3B8)),
                  ),
                  if (call.hasAudio) ...[
                    const SizedBox(height: 4),
                    LeadAudioPlayerCard(
                      durationText: call.duration,
                      waveformPoints: call.waveformPoints,
                    ),
                    const SizedBox(height: 10),
                  ],
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }
}
