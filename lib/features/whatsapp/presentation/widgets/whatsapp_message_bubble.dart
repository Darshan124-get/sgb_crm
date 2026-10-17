import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';
import '../../data/whatsapp_service.dart';
import '../../domain/models/whatsapp_model.dart';

/// WhatsApp-style centered date separator chip (Today, Yesterday, or formatted date)
class WhatsAppDateSeparator extends StatelessWidget {
  final DateTime date;

  const WhatsAppDateSeparator({super.key, required this.date});

  String _formatDate() {
    final localDate = date.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDate = DateTime(localDate.year, localDate.month, localDate.day);

    final diffDays = today.difference(msgDate).inDays;
    if (diffDays == 0) {
      return 'Today';
    } else if (diffDays == 1) {
      return 'Yesterday';
    } else if (diffDays > 1 && diffDays < 7) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[localDate.weekday - 1];
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${localDate.day} ${months[localDate.month - 1]} ${localDate.year}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Text(
          _formatDate(),
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF54656F),
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }
}

class WhatsAppMessageBubble extends StatelessWidget {
  final WhatsAppMessage message;
  final bool isSelected;
  final VoidCallback? onLongPress;
  final VoidCallback? onTap;
  final ValueChanged<String>? onTemplateActionPressed;
  final VoidCallback? onVerifyPayment;
  final VoidCallback? onRejectPayment;

  const WhatsAppMessageBubble({
    super.key,
    required this.message,
    this.isSelected = false,
    this.onLongPress,
    this.onTap,
    this.onTemplateActionPressed,
    this.onVerifyPayment,
    this.onRejectPayment,
  });

  // Static bounded cache for decoded base64 image bytes to prevent GC churn during scroll
  static final Map<String, Uint8List> _base64Cache = {};

  static Uint8List? _getCachedBase64Bytes(String dataUriOrBase64) {
    if (_base64Cache.containsKey(dataUriOrBase64)) {
      return _base64Cache[dataUriOrBase64];
    }
    try {
      final commaIdx = dataUriOrBase64.indexOf(',');
      final b64 = commaIdx != -1 ? dataUriOrBase64.substring(commaIdx + 1) : dataUriOrBase64;
      final bytes = base64Decode(b64);
      if (_base64Cache.length > 50) {
        _base64Cache.remove(_base64Cache.keys.first);
      }
      _base64Cache[dataUriOrBase64] = bytes;
      return bytes;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOut = message.isOutgoing;

    return RepaintBoundary(
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        splashColor: Colors.transparent,
        highlightColor: const Color(0xFF008069).withValues(alpha: 0.08),
        child: Container(
        color: isSelected ? const Color(0xFF008069).withValues(alpha: 0.16) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 3.5),
        child: Row(
          mainAxisAlignment: isOut ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.78,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: isOut ? const Color(0xFFD9FDD3) : Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(14),
                    topRight: const Radius.circular(14),
                    bottomLeft: Radius.circular(isOut ? 14 : 2),
                    bottomRight: Radius.circular(isOut ? 2 : 14),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Forwarded Banner
                    if (message.isForwarded) ...[
                      const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.reply_rounded, size: 14, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text(
                            'Forwarded',
                            style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                    ],

                    // Quoted Reply Card
                    if (message.replyToText != null && message.replyToText!.isNotEmpty) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                          color: isOut ? const Color(0xFFC7F3BF).withValues(alpha: 0.7) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border(
                            left: BorderSide(
                              color: isOut ? const Color(0xFF008069) : const Color(0xFF0284C7),
                              width: 3.5,
                            ),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              message.replyToSender ?? (isOut ? 'You' : 'Customer'),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isOut ? const Color(0xFF008069) : const Color(0xFF0284C7),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              message.replyToText!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // 0. Image Media Attachment
                    if (message.type == MessageType.image) ...[
                      _buildImageAttachment(context, isOut),
                    ],

                    // 0.1 Video Media Attachment
                    if (message.type == MessageType.video) ...[
                      _buildVideoAttachment(context, isOut),
                    ],

                    // 0.2 Audio / Voice Note Message
                    if (message.type == MessageType.audio) ...[
                      _WhatsAppAudioPlayer(message: message, isOutgoing: isOut),
                    ],

                    // 1. Document / PDF Attachment
                    if (message.type == MessageType.document) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: isOut ? const Color(0xFFC7F3BF) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFDC2626), size: 22),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    message.mediaName ?? 'Document.pdf',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    message.mediaSize ?? 'PDF Document',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.download_rounded, color: Color(0xFF008069), size: 20),
                          ],
                        ),
                      ),
                    ],

                    // 2. Payment Proof Screenshot Card
                    if (message.type == MessageType.paymentProof) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFE0F2FE),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF0284C7), size: 18),
                                ),
                                const SizedBox(width: 8),
                                const Expanded(
                                  child: Text(
                                    'UPI Transaction Screenshot',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: message.isPaymentVerified ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    message.isPaymentVerified ? 'VERIFIED' : 'PENDING',
                                    style: TextStyle(
                                      color: message.isPaymentVerified ? const Color(0xFF166534) : const Color(0xFFB45309),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 10),

                            if (!message.isPaymentVerified)
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: onVerifyPayment,
                                      icon: const Icon(Icons.check_circle_rounded, size: 15, color: Colors.white),
                                      label: const Text('Verify Payment', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Colors.white)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF16A34A),
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(vertical: 7),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  OutlinedButton(
                                    onPressed: onRejectPayment,
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFFDC2626),
                                      side: const BorderSide(color: Color(0xFFFCA5A5)),
                                      visualDensity: VisualDensity.compact,
                                      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 10),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    child: const Text('Reject', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ],

                    // 3. Main Message Text (if text is present and not synthetic)
                    if (message.text.trim().isNotEmpty && !WhatsAppMessage.isSyntheticMediaText(message.text)) ...[
                      Text(
                        message.text,
                        style: const TextStyle(
                          color: Color(0xFF111B21),
                          fontSize: 14.5,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 2),
                    ],

                    // 4. Template Interactive Quick Buttons
                    if (message.templateButtons.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      const Divider(height: 1, color: Color(0xFFBBE5B3)),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: message.templateButtons.map((btnLabel) {
                          return GestureDetector(
                            onTap: () => onTemplateActionPressed?.call(btnLabel),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFF008069).withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.touch_app_rounded, size: 13, color: Color(0xFF008069)),
                                  const SizedBox(width: 4),
                                  Text(
                                    btnLabel,
                                    style: const TextStyle(
                                      color: Color(0xFF008069),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],

                    const SizedBox(height: 2),

                    // 5. Time & WhatsApp Read Receipts
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          message.timestamp,
                          style: const TextStyle(
                            color: Color(0xFF667781),
                            fontSize: 11,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        if (isOut) ...[
                          const SizedBox(width: 4),
                          _buildStatusTicks(message.status),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildStatusTicks(MessageStatus status) {
    switch (status) {
      case MessageStatus.sent:
        return const Icon(
          Icons.done_rounded,
          size: 15,
          color: Color(0xFF8696A0),
        );
      case MessageStatus.delivered:
        return const Icon(
          Icons.done_all_rounded,
          size: 15,
          color: Color(0xFF8696A0),
        );
      case MessageStatus.read:
        return const Icon(
          Icons.done_all_rounded,
          size: 15,
          color: Color(0xFF53BDEB),
        );
    }
  }

  Widget _buildImageAttachment(BuildContext context, bool isOut) {
    final rawAsset = message.mediaAsset;
    final resolved = WhatsAppService.resolveMediaUrl(rawAsset);

    final isHttp = resolved.startsWith('http://') || resolved.startsWith('https://');
    final isDataUri = resolved.startsWith('data:');
    final isLocalFile = !isHttp && !isDataUri && resolved.isNotEmpty && (resolved.startsWith('/') || resolved.contains('\\') || resolved.startsWith('file:'));

    Widget imageWidget;
    if (isDataUri) {
      final bytes = _getCachedBase64Bytes(resolved);
      if (bytes != null) {
        imageWidget = Image.memory(
          bytes,
          cacheWidth: 600,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildPlaceholderPhoto(context, resolved),
        );
      } else {
        imageWidget = _buildPlaceholderPhoto(context, resolved);
      }
    } else if (isHttp) {
      imageWidget = Image.network(
        resolved,
        cacheWidth: 600,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            height: 180,
            color: isOut ? const Color(0xFFC7F3BF) : const Color(0xFFF1F5F9),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  value: loadingProgress.expectedTotalBytes != null
                      ? loadingProgress.cumulativeBytesLoaded / loadingProgress.expectedTotalBytes!
                      : null,
                  strokeWidth: 2.2,
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF008069)),
                ),
              ),
            ),
          );
        },
        errorBuilder: (_, __, ___) => _buildPlaceholderPhoto(context, resolved),
      );
    } else if (isLocalFile) {
      final filePath = resolved.startsWith('file://') ? resolved.substring(7) : resolved;
      imageWidget = Image.file(
        File(filePath),
        cacheWidth: 600,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildPlaceholderPhoto(context, resolved),
      );
    } else {
      imageWidget = _buildPlaceholderPhoto(context, resolved);
    }

    return RepaintBoundary(
      child: GestureDetector(
        onTap: () => _showFullScreenPreview(context, resolved, message.mediaName),
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: isOut ? const Color(0xFFC7F3BF) : const Color(0xFFF1F5F9),
          ),
          clipBehavior: Clip.antiAlias,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxHeight: 260,
              minHeight: 120,
              minWidth: double.infinity,
            ),
            child: imageWidget,
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderPhoto(BuildContext context, String resolvedUrl) {
    return Container(
      height: 150,
      color: const Color(0xFFF1F5F9),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.photo_size_select_actual_outlined, size: 28, color: Color(0xFF008069)),
            ),
            const SizedBox(height: 6),
            Text(
              (message.mediaName != null && !message.mediaName!.contains('/'))
                  ? message.mediaName!
                  : 'Photo Attachment',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
            ),
          ],
        ),
      ),
    );
  }

  void _showFullScreenPreview(BuildContext context, String assetUrl, String? title) {
    if (assetUrl.isEmpty) return;
    showDialog(
      context: context,
      builder: (ctx) {
        Widget previewWidget;
        if (assetUrl.startsWith('data:')) {
          try {
            final comma = assetUrl.indexOf(',');
            final b64 = comma != -1 ? assetUrl.substring(comma + 1) : assetUrl;
            previewWidget = Image.memory(base64Decode(b64));
          } catch (_) {
            previewWidget = const Icon(Icons.broken_image_rounded, color: Colors.white, size: 60);
          }
        } else if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
          previewWidget = Image.network(
            assetUrl,
            loadingBuilder: (_, child, p) => p == null ? child : const Center(child: CircularProgressIndicator(color: Colors.white)),
            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_rounded, color: Colors.white, size: 60),
          );
        } else if (File(assetUrl).existsSync()) {
          previewWidget = Image.file(File(assetUrl));
        } else {
          previewWidget = const Icon(Icons.broken_image_rounded, color: Colors.white, size: 60);
        }

        return Dialog(
          backgroundColor: Colors.black.withValues(alpha: 0.94),
          insetPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 20),
          child: Stack(
            alignment: Alignment.center,
            children: [
              InteractiveViewer(
                minScale: 0.8,
                maxScale: 4.0,
                child: previewWidget,
              ),
              Positioned(
                top: 10,
                left: 10,
                child: _ImageDownloadButton(assetUrl: assetUrl, title: title),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ),
              if (title != null && title.trim().isNotEmpty && !title.contains('/') && !WhatsAppMessage.isSyntheticMediaText(title))
                Positioned(
                  bottom: 15,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVideoAttachment(BuildContext context, bool isOut) {
    final rawAsset = message.mediaAsset;
    final resolved = WhatsAppService.resolveMediaUrl(rawAsset);

    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (ctx) => _WhatsAppVideoViewerDialog(
            videoUrl: resolved,
            title: message.mediaName ?? 'Video Demo',
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(12),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 140,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Color(0xFF008069), size: 34),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.videocam_rounded, color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text('VIDEO DEMO', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('01:45', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              color: const Color(0xFF1E293B),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Row(
                children: [
                  const Icon(Icons.play_circle_outline_rounded, size: 16, color: Color(0xFF38BDF8)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      message.mediaName ?? 'Video Demo.mp4',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                  const Text('MP4', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _downloadMediaFile(BuildContext context, String rawUrl, String defaultName) async {
  try {
    final resolved = WhatsAppService.resolveMediaUrl(rawUrl);
    Uint8List? bytes;
    if (resolved.startsWith('data:')) {
      final comma = resolved.indexOf(',');
      final b64 = comma != -1 ? resolved.substring(comma + 1) : resolved;
      bytes = base64Decode(b64);
    } else if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      final res = await http.get(Uri.parse(resolved));
      if (res.statusCode == 200) {
        bytes = res.bodyBytes;
      }
    } else if (File(resolved).existsSync()) {
      bytes = await File(resolved).readAsBytes();
    }

    if (bytes != null && bytes.isNotEmpty) {
      final dir = await getExternalStorageDirectory() ?? await getApplicationDocumentsDirectory();
      final cleanName = defaultName.replaceAll(RegExp(r'[^\w\.-]'), '_');
      final file = File('${dir.path}/$cleanName');
      await file.writeAsBytes(bytes);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Saved to device: $cleanName'),
            backgroundColor: const Color(0xFF008069),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } else {
      throw Exception('Media file content unavailable');
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Download failed: $e'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _ImageDownloadButton extends StatefulWidget {
  final String assetUrl;
  final String? title;

  const _ImageDownloadButton({required this.assetUrl, this.title});

  @override
  State<_ImageDownloadButton> createState() => _ImageDownloadButtonState();
}

class _ImageDownloadButtonState extends State<_ImageDownloadButton> {
  bool _isDownloading = false;

  @override
  Widget build(BuildContext context) {
    return _isDownloading
        ? Container(
            padding: const EdgeInsets.all(8),
            child: const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            ),
          )
        : IconButton(
            icon: const Icon(Icons.download_rounded, color: Colors.white, size: 26),
            tooltip: 'Save to device',
            onPressed: () async {
              setState(() => _isDownloading = true);
              try {
                final name = widget.title != null && widget.title!.isNotEmpty && !widget.title!.contains('/')
                    ? (widget.title!.contains('.') ? widget.title! : '${widget.title}.jpg')
                    : 'photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
                await _downloadMediaFile(context, widget.assetUrl, name);
              } finally {
                if (mounted) setState(() => _isDownloading = false);
              }
            },
          );
  }
}

/// WhatsApp Audio / Voice Note Player Widget with Live Audio Playback
class _WhatsAppAudioPlayer extends StatefulWidget {
  final WhatsAppMessage message;
  final bool isOutgoing;

  const _WhatsAppAudioPlayer({required this.message, required this.isOutgoing});

  @override
  State<_WhatsAppAudioPlayer> createState() => _WhatsAppAudioPlayerState();
}

class _WhatsAppAudioPlayerState extends State<_WhatsAppAudioPlayer> {
  static const List<double> _waveformHeights = [
    8.0, 14.0, 20.0, 12.0, 16.0, 22.0, 18.0, 10.0, 14.0, 20.0, 16.0, 8.0, 18.0, 22.0, 14.0, 10.0, 16.0, 20.0, 12.0, 18.0, 14.0, 8.0
  ];

  AudioPlayer? _player;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _stateSub;
  StreamSubscription? _completeSub;
  Timer? _fallbackTimer;
  double _fallbackProgress = 0.0;
  int _fallbackSeconds = 0;

  @override
  void initState() {
    super.initState();
    if (widget.message.audioDuration != null) {
      final parts = widget.message.audioDuration!.split(':');
      if (parts.length == 2) {
        final m = int.tryParse(parts[0]) ?? 0;
        final s = int.tryParse(parts[1]) ?? 0;
        _duration = Duration(seconds: m * 60 + s);
      }
    }
  }

  void _initPlayerIfNeeded() {
    if (_player != null) return;
    _player = AudioPlayer();
    _posSub = _player!.onPositionChanged.listen((pos) {
      if (mounted) {
        setState(() {
          _position = pos;
        });
      }
    });
    _durSub = _player!.onDurationChanged.listen((dur) {
      if (mounted && dur.inMilliseconds > 0) {
        setState(() {
          _duration = dur;
        });
      }
    });
    _stateSub = _player!.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() {
          _isPlaying = state == PlayerState.playing;
        });
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

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _completeSub?.cancel();
    _fallbackTimer?.cancel();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    final asset = widget.message.mediaAsset;
    final resolved = WhatsAppService.resolveMediaUrl(asset);

    if (resolved.isNotEmpty) {
      _initPlayerIfNeeded();
      if (_isPlaying) {
        await _player?.pause();
      } else {
        try {
          if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
            await _player?.play(UrlSource(resolved));
          } else if (resolved.startsWith('data:')) {
            final comma = resolved.indexOf(',');
            final b64 = comma != -1 ? resolved.substring(comma + 1) : resolved;
            await _player?.play(BytesSource(base64Decode(b64)));
          } else if (File(resolved).existsSync()) {
            await _player?.play(DeviceFileSource(resolved));
          } else {
            _runFallbackTimer();
          }
        } catch (_) {
          _runFallbackTimer();
        }
      }
    } else {
      _runFallbackTimer();
    }
  }

  void _runFallbackTimer() {
    setState(() {
      _isPlaying = !_isPlaying;
      if (_isPlaying) {
        final total = _duration.inSeconds > 0 ? _duration.inSeconds : 8;
        _fallbackTimer?.cancel();
        _fallbackTimer = Timer.periodic(const Duration(milliseconds: 200), (t) {
          if (!mounted) return;
          setState(() {
            _fallbackSeconds++;
            _fallbackProgress = (_fallbackSeconds / (total * 5)).clamp(0.0, 1.0);
            if (_fallbackProgress >= 1.0) {
              _isPlaying = false;
              _fallbackTimer?.cancel();
              _fallbackSeconds = 0;
              _fallbackProgress = 0.0;
            }
          });
        });
      } else {
        _fallbackTimer?.cancel();
      }
    });
  }

  String _formatTime(Duration d) {
    final m = d.inMinutes.toString();
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = widget.isOutgoing ? const Color(0xFF008069) : const Color(0xFF0284C7);
    final double progress = _duration.inMilliseconds > 0
        ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0)
        : _fallbackProgress;
    final String timeStr = _isPlaying
        ? _formatTime(_position)
        : (_duration.inSeconds > 0
            ? _formatTime(_duration)
            : (widget.message.audioDuration ?? '0:00'));

    return RepaintBoundary(
      child: Container(
        width: 230,
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            // Play / Pause Circle
            GestureDetector(
              onTap: _togglePlay,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accentColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Waveform and Duration
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    height: 20,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: List.generate(22, (i) {
                        final barHeight = _waveformHeights[i % _waveformHeights.length];
                        final isPlayed = (i / 22) <= progress;

                        return Container(
                          width: 2.8,
                          height: barHeight,
                          decoration: BoxDecoration(
                            color: isPlayed ? accentColor : const Color(0xFF94A3B8),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        timeStr,
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                      const Icon(Icons.mic_rounded, size: 12, color: Color(0xFF008069)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// In-App Video Viewer Dialog with VideoPlayer Playback and Download Controls
class _WhatsAppVideoViewerDialog extends StatefulWidget {
  final String videoUrl;
  final String title;

  const _WhatsAppVideoViewerDialog({required this.videoUrl, required this.title});

  @override
  State<_WhatsAppVideoViewerDialog> createState() => _WhatsAppVideoViewerDialogState();
}

class _WhatsAppVideoViewerDialogState extends State<_WhatsAppVideoViewerDialog> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _initVideo();
  }

  Future<void> _initVideo() async {
    try {
      final url = widget.videoUrl;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        _controller = VideoPlayerController.networkUrl(Uri.parse(url));
      } else if (File(url).existsSync()) {
        _controller = VideoPlayerController.file(File(url));
      } else {
        setState(() => _hasError = true);
        return;
      }

      await _controller!.initialize();
      _controller!.addListener(_onControllerUpdate);
      _controller!.play();
      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isPlaying = true;
          _duration = _controller!.value.duration;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _hasError = true);
    }
  }

  void _onControllerUpdate() {
    if (!mounted || _controller == null) return;
    final val = _controller!.value;
    setState(() {
      _position = val.position;
      _isPlaying = val.isPlaying;
      if (val.duration.inMilliseconds > 0) {
        _duration = val.duration;
      }
    });
  }

  @override
  void dispose() {
    _controller?.removeListener(_onControllerUpdate);
    _controller?.dispose();
    super.dispose();
  }

  String _format(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _download() async {
    if (_isDownloading) return;
    setState(() => _isDownloading = true);
    try {
      final name = widget.title.endsWith('.mp4') ? widget.title : '${widget.title}.mp4';
      await _downloadMediaFile(context, widget.videoUrl, name);
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black.withValues(alpha: 0.95),
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header with Title, Download, and Close
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.videocam_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ),
                  _isDownloading
                      ? Container(
                          padding: const EdgeInsets.all(8),
                          child: const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(Icons.download_rounded, color: Colors.white, size: 22),
                          tooltip: 'Save video',
                          onPressed: _download,
                        ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Video Screen
            Container(
              height: 240,
              width: double.infinity,
              color: const Color(0xFF0F172A),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (_isInitialized && _controller != null)
                    GestureDetector(
                      onTap: () {
                        if (_controller!.value.isPlaying) {
                          _controller!.pause();
                        } else {
                          _controller!.play();
                        }
                      },
                      child: Center(
                        child: AspectRatio(
                          aspectRatio: _controller!.value.aspectRatio,
                          child: VideoPlayer(_controller!),
                        ),
                      ),
                    )
                  else if (_hasError)
                    const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.error_outline_rounded, size: 44, color: Color(0xFFEF4444)),
                          SizedBox(height: 8),
                          Text('Could not play video', style: TextStyle(color: Colors.white70, fontSize: 13)),
                        ],
                      ),
                    )
                  else
                    const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 32,
                            height: 32,
                            child: CircularProgressIndicator(color: Color(0xFF008069), strokeWidth: 2.5),
                          ),
                          SizedBox(height: 12),
                          Text('Loading video...', style: TextStyle(color: Colors.white70, fontSize: 13)),
                        ],
                      ),
                    ),

                  // Play/Pause Floating Overlay when paused
                  if (_isInitialized && _controller != null && !_isPlaying)
                    GestureDetector(
                      onTap: () => _controller!.play(),
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 36),
                      ),
                    ),
                ],
              ),
            ),

            // Playback Scrubber and Controls
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: Column(
                children: [
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: const Color(0xFF008069),
                      inactiveTrackColor: Colors.white24,
                      thumbColor: const Color(0xFF25D366),
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                      trackHeight: 3,
                    ),
                    child: Slider(
                      value: _duration.inMilliseconds > 0
                          ? _position.inMilliseconds.clamp(0, _duration.inMilliseconds).toDouble()
                          : 0.0,
                      max: _duration.inMilliseconds > 0 ? _duration.inMilliseconds.toDouble() : 1.0,
                      onChanged: (val) {
                        _controller?.seekTo(Duration(milliseconds: val.toInt()));
                      },
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_format(_position)} / ${_format(_duration)}',
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: Icon(_isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white, size: 22),
                            onPressed: () {
                              if (_controller != null) {
                                if (_isPlaying) {
                                  _controller!.pause();
                                } else {
                                  _controller!.play();
                                }
                              }
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 20),
                            onPressed: () {
                              if (_controller != null) {
                                final newPos = _position - const Duration(seconds: 10);
                                _controller!.seekTo(newPos < Duration.zero ? Duration.zero : newPos);
                              }
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 20),
                            onPressed: () {
                              if (_controller != null) {
                                final newPos = _position + const Duration(seconds: 10);
                                _controller!.seekTo(newPos > _duration ? _duration : newPos);
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
