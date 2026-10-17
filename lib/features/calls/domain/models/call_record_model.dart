import 'package:flutter/material.dart';
import '../../../../core/network/api_config.dart';

class CallRecordModel {
  final int id;
  final String? callId;
  final String? acefoneCallId;
  final String customerPhone;
  final String? leadId;
  final String? leadName;
  final int? crmUserId;
  final String? crmUserName;
  final String? agentExtension;
  final String direction;
  final DateTime startedAt;
  final int durationSeconds;
  final int talkTimeSeconds;
  final String technicalStatus;
  final String? hangupReason;
  final String? didNumber;
  final String? recordingUrl;
  final String? r2ObjectKey;

  const CallRecordModel({
    required this.id,
    this.callId,
    this.acefoneCallId,
    required this.customerPhone,
    this.leadId,
    this.leadName,
    this.crmUserId,
    this.crmUserName,
    this.agentExtension,
    required this.direction,
    required this.startedAt,
    this.durationSeconds = 0,
    this.talkTimeSeconds = 0,
    required this.technicalStatus,
    this.hangupReason,
    this.didNumber,
    this.recordingUrl,
    this.r2ObjectKey,
  });

  bool get isOutbound =>
      direction.toLowerCase().contains('out') || direction.toLowerCase() == 'outbound';

  bool get isAnswered =>
      (technicalStatus.toUpperCase() == 'CONNECTED' ||
       technicalStatus.toUpperCase() == 'COMPLETED' ||
       technicalStatus.toUpperCase() == 'ANSWERED') &&
      talkTimeSeconds > 0;

  bool get isMissed =>
      technicalStatus.toUpperCase() == 'MISSED' ||
      technicalStatus.toUpperCase() == 'NO_ANSWER' ||
      technicalStatus.toUpperCase() == 'CANCELLED' ||
      (!isBusy && talkTimeSeconds == 0 &&
       !['REQUESTED', 'INITIATING', 'RINGING_AGENT', 'AGENT_ANSWERED', 'CUSTOMER_RINGING'].contains(technicalStatus.toUpperCase()));

  bool get isBusy => technicalStatus.toUpperCase() == 'BUSY';

  Color get statusColor {
    if (isAnswered) return const Color(0xFF059669); // Green
    if (isMissed) return const Color(0xFFDC2626); // Red
    if (isBusy) return const Color(0xFFD97706); // Amber
    return const Color(0xFF64748B); // Slate
  }

  Color get statusBgColor {
    if (isAnswered) return const Color(0xFFDCFCE7);
    if (isMissed) return const Color(0xFFFEE2E2);
    if (isBusy) return const Color(0xFFFEF3C7);
    return const Color(0xFFF1F5F9);
  }

  String get statusLabel {
    if (isAnswered) return 'Connected';
    if (isMissed) return 'Missed';
    if (isBusy) return 'Busy';
    if (technicalStatus.toUpperCase() == 'NO_ANSWER') return 'No Answer';
    if (['REQUESTED', 'INITIATING'].contains(technicalStatus.toUpperCase())) return 'Requested';
    if (['RINGING_AGENT', 'CUSTOMER_RINGING', 'AGENT_ANSWERED'].contains(technicalStatus.toUpperCase())) return 'Ringing';
    return technicalStatus.isNotEmpty ? technicalStatus : 'Missed';
  }

  String get formattedDuration => _formatDuration(durationSeconds);
  String get formattedTalkTime => _formatDuration(talkTimeSeconds);

  static String _formatDuration(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    final hours = s ~/ 3600;
    final mins = (s % 3600) ~/ 60;
    final secs = s % 60;
    if (hours > 0) {
      return '$hours:${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    }
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  bool get hasAudio =>
      (r2ObjectKey != null && r2ObjectKey!.trim().isNotEmpty) ||
      (recordingUrl != null && recordingUrl!.trim().isNotEmpty);

  String? get audioStreamUrl {
    if (r2ObjectKey != null && r2ObjectKey!.trim().isNotEmpty) {
      final base = ApiConfig.baseUrl.replaceAll(RegExp(r'/+$'), '');
      return '$base/media/$r2ObjectKey';
    }
    return recordingUrl;
  }

  factory CallRecordModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic d) {
      if (d == null) return DateTime.now();
      if (d is DateTime) return d.toLocal();
      try {
        final str = d.toString();
        final dateToParse = (str.contains('Z') || str.contains('+') || (str.length > 10 && str.substring(10).contains('-')))
            ? str
            : '${str.replaceFirst(' ', 'T')}Z';
        final parsed = DateTime.parse(dateToParse);
        return parsed.toLocal();
      } catch (_) {
        return DateTime.now();
      }
    }

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      return int.tryParse(val.toString()) ?? 0;
    }

    return CallRecordModel(
      id: parseInt(json['id']),
      callId: json['call_id']?.toString(),
      acefoneCallId: json['acefone_call_id']?.toString(),
      customerPhone: json['customer_phone']?.toString() ?? '--',
      leadId: json['lead_id']?.toString(),
      leadName: json['lead_name']?.toString() ?? json['customer_name']?.toString(),
      crmUserId: json['crm_user_id'] != null ? parseInt(json['crm_user_id']) : null,
      crmUserName: json['crm_user_name']?.toString() ?? json['agent_name']?.toString(),
      agentExtension: json['agent_extension']?.toString(),
      direction: json['direction']?.toString() ?? 'outbound',
      startedAt: parseDate(json['started_at'] ?? json['start_time']),
      durationSeconds: parseInt(json['duration_seconds'] ?? json['duration']),
      talkTimeSeconds: parseInt(json['talk_time_seconds'] ?? json['talk_time']),
      technicalStatus: json['technical_status']?.toString() ?? json['status']?.toString() ?? 'COMPLETED',
      hangupReason: json['hangup_reason']?.toString() ?? json['hangup_cause']?.toString(),
      didNumber: json['did_number']?.toString() ?? json['caller_id']?.toString(),
      recordingUrl: json['recording_url']?.toString() ?? json['acefone_recording_url']?.toString(),
      r2ObjectKey: json['r2_object_key']?.toString(),
    );
  }

  static List<CallRecordModel> sampleCalls() {
    final now = DateTime.now();
    return [
      CallRecordModel(
        id: 1,
        callId: 'call_SRVINF-SRV142.3-1792159218.350810',
        acefoneCallId: 'SRVINF-SRV142.3-1792159218.350810',
        customerPhone: '+919902018031',
        leadId: 'L-101',
        leadName: 'Ramesh Patil',
        crmUserName: 'Darshan A B',
        agentExtension: '1001',
        direction: 'outbound',
        startedAt: now.subtract(const Duration(minutes: 14)),
        durationSeconds: 142,
        talkTimeSeconds: 130,
        technicalStatus: 'CONNECTED',
        hangupReason: 'Normal Clearing',
        didNumber: '+918047192200',
        r2ObjectKey: 'telephony/recordings/2026/10/call_SRVINF-SRV142.3-1792159218.350810.mp3',
      ),
      CallRecordModel(
        id: 2,
        callId: 'call_SRVINF-SRV142.3-1792159217.350809',
        acefoneCallId: 'SRVINF-SRV142.3-1792159217.350809',
        customerPhone: '+919876543210',
        leadId: 'L-102',
        leadName: 'Suresh Kumar',
        crmUserName: 'Darshan A B',
        agentExtension: '1001',
        direction: 'outbound',
        startedAt: now.subtract(const Duration(hours: 1, minutes: 20)),
        durationSeconds: 0,
        talkTimeSeconds: 0,
        technicalStatus: 'MISSED',
        hangupReason: 'User Busy / No Answer',
        didNumber: '+918047192200',
      ),
      CallRecordModel(
        id: 3,
        callId: 'call_SRVINF-SRV142.3-1792159216.350808',
        acefoneCallId: 'SRVINF-SRV142.3-1792159216.350808',
        customerPhone: '+918765432109',
        leadId: 'L-103',
        leadName: 'Anita Desai',
        crmUserName: 'Priya Sharma',
        agentExtension: '1002',
        direction: 'inbound',
        startedAt: now.subtract(const Duration(hours: 3, minutes: 45)),
        durationSeconds: 278,
        talkTimeSeconds: 260,
        technicalStatus: 'CONNECTED',
        hangupReason: 'Normal Clearing',
        didNumber: '+918047192200',
      ),
    ];
  }
}
