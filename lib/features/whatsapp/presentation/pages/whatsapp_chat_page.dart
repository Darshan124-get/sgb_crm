import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../data/whatsapp_service.dart';
import '../../domain/models/whatsapp_model.dart';
import '../widgets/whatsapp_attachment_sheet.dart';
import '../widgets/whatsapp_contact_details_sheet.dart';
import '../widgets/whatsapp_message_bubble.dart';
import '../widgets/whatsapp_quick_replies_sheet.dart';
import '../../../../core/services/telephony_service.dart';

class WhatsAppChatPage extends StatefulWidget {
  final WhatsAppConversation conversation;

  const WhatsAppChatPage({
    super.key,
    required this.conversation,
  });

  @override
  State<WhatsAppChatPage> createState() => _WhatsAppChatPageState();
}

class _WhatsAppChatPageState extends State<WhatsAppChatPage> with WidgetsBindingObserver {
  late WhatsAppConversation _conversation;
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isHandoffActive = false;
  bool _isPaymentPending = false;
  bool _isLoadingHistory = false;
  bool _isSilentSyncing = false;
  bool _isUserNearBottom = true;
  final ValueNotifier<bool> _isNearBottomNotifier = ValueNotifier<bool>(true);
  final ValueNotifier<int> _unseenCountNotifier = ValueNotifier<int>(0);
  int _unseenNewMessagesCount = 0;
  Timer? _chatPollTimer;
  Timer? _windowTimer;

  // Message selection & quoted reply states
  WhatsAppMessage? _selectedMessage;
  WhatsAppMessage? _replyingToMessage;

  // Real-time Voice Note recording state
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _recordedAudioPath;
  bool _isRecordingAudio = false;
  int _recordSeconds = 0;
  Timer? _recordTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _conversation = widget.conversation;
    _isHandoffActive = _conversation.isHandoff;
    _isPaymentPending = _conversation.isPaymentPending;

    _scrollController.addListener(_onScroll);

    _loadChatHistory();
    WhatsAppService.markRead(_conversation.phone);
    _startChatPolling();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    final nearBottom = (maxScroll - currentScroll) < 180;
    if (nearBottom != _isUserNearBottom) {
      _isUserNearBottom = nearBottom;
      _isNearBottomNotifier.value = nearBottom;
      if (nearBottom) {
        _unseenNewMessagesCount = 0;
        _unseenCountNotifier.value = 0;
      }
    }
  }

  void _startChatPolling() {
    _chatPollTimer?.cancel();
    _chatPollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _silentPollHistory();
    });

    _windowTimer?.cancel();
    _windowTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  void _stopChatPolling() {
    _chatPollTimer?.cancel();
    _chatPollTimer = null;
    _windowTimer?.cancel();
    _windowTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startChatPolling();
      _silentPollHistory();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _stopChatPolling();
    }
  }

  Future<void> _loadChatHistory() async {
    if (_conversation.phone.isEmpty) return;
    if (_conversation.messages.isEmpty) {
      setState(() => _isLoadingHistory = true);
    }
    try {
      final history = await WhatsAppService.getChatHistory(_conversation.phone);
      if (!mounted) return;
      if (history.isNotEmpty) {
        final merged = _mergeHistory(_conversation.messages, history);
        setState(() {
          _conversation = _conversation.copyWith(
            lastMessage: merged.last.text.isNotEmpty ? merged.last.text : (merged.last.mediaName ?? 'Media'),
            time: merged.last.timestamp,
            messages: merged,
            unreadCount: 0,
          );
          _isLoadingHistory = false;
        });
        _scrollToBottom();
      } else {
        setState(() => _isLoadingHistory = false);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingHistory = false);
    }
  }

  Future<void> _silentPollHistory() async {
    if (_conversation.phone.isEmpty || _isSilentSyncing) return;
    // Never interrupt active fling/scroll gestures with poll updates
    if (_scrollController.hasClients && _scrollController.position.isScrollingNotifier.value) {
      return;
    }
    _isSilentSyncing = true;
    try {
      final history = await WhatsAppService.getChatHistory(_conversation.phone);
      if (!mounted) return;
      if (history.isNotEmpty) {
        final merged = _mergeHistory(_conversation.messages, history);
        final bool changed = _hasHistoryChanged(_conversation.messages, merged);
        if (changed) {
          final wasCount = _conversation.messages.length;
          final newCount = merged.length;
          final bool hasNewIncoming = newCount > wasCount && !merged.last.isOutgoing;

          setState(() {
            _conversation = _conversation.copyWith(
              lastMessage: merged.last.text.isNotEmpty ? merged.last.text : (merged.last.mediaName ?? 'Media'),
              time: merged.last.timestamp,
              messages: merged,
              unreadCount: hasNewIncoming ? _conversation.unreadCount + 1 : 0,
            );
            if (!_isUserNearBottom && newCount > wasCount) {
              _unseenNewMessagesCount += (newCount - wasCount);
              _unseenCountNotifier.value = _unseenNewMessagesCount;
            }
          });

          // ONLY auto-scroll to bottom if a brand new INCOMING customer message arrives AND user is near bottom.
          // NEVER auto-scroll or interrupt the user on background status sync or poll cycles!
          if (hasNewIncoming && _isUserNearBottom) {
            _scrollToBottom();
            HapticFeedback.lightImpact();
            WhatsAppService.markRead(_conversation.phone);
          }
        }
      }
    } catch (_) {
      // Silently ignore background poll errors
    } finally {
      _isSilentSyncing = false;
    }
  }

  /// Merges server history with local optimistic messages to guarantee ZERO latency and ZERO flicker
  List<WhatsAppMessage> _mergeHistory(List<WhatsAppMessage> current, List<WhatsAppMessage> serverHistory) {
    if (serverHistory.isEmpty) return current;

    final now = DateTime.now();

    final unconfirmed = current.where((localMsg) {
      if (!localMsg.id.startsWith('msg_')) return false;

      // 1. Strict TTL: Discard any optimistic message older than 15 seconds
      // to ensure it NEVER stays pinned or stuck at the bottom of the chat.
      if (localMsg.rawTimestamp != null) {
        final ageSeconds = now.difference(localMsg.rawTimestamp!).inSeconds;
        if (ageSeconds > 15) return false;
      }

      // 2. Check if this local optimistic message is already confirmed in the server history
      final alreadyInServer = serverHistory.any((srvMsg) {
        if (!srvMsg.isOutgoing) return false;

        // A. Match text message
        if (localMsg.text.isNotEmpty && srvMsg.text == localMsg.text) {
          if (srvMsg.rawTimestamp != null && localMsg.rawTimestamp != null) {
            final diff = (srvMsg.rawTimestamp!.difference(localMsg.rawTimestamp!).inSeconds).abs();
            if (diff <= 60) return true;
          } else {
            return true;
          }
        }

        // B. Match media message
        if (localMsg.mediaAsset != null) {
          if (srvMsg.mediaAsset != null) {
            final localFile = localMsg.mediaAsset!.split('/').last.split('\\').last;
            if (srvMsg.mediaAsset!.contains(localFile)) return true;

            // Same media type and sent within 45 seconds
            if (srvMsg.type == localMsg.type) {
              if (srvMsg.rawTimestamp != null && localMsg.rawTimestamp != null) {
                final diff = (srvMsg.rawTimestamp!.difference(localMsg.rawTimestamp!).inSeconds).abs();
                if (diff <= 45) return true;
              } else {
                return true;
              }
            }
          }
        }

        return false;
      });

      return !alreadyInServer;
    }).toList();

    return [...serverHistory, ...unconfirmed];
  }

  bool _hasHistoryChanged(List<WhatsAppMessage> oldMsgs, List<WhatsAppMessage> newMsgs) {
    if (oldMsgs.length != newMsgs.length) return true;
    for (int i = 0; i < oldMsgs.length; i++) {
      final o = oldMsgs[i];
      final n = newMsgs[i];
      if (o.id != n.id ||
          o.status != n.status ||
          o.text != n.text ||
          o.mediaAsset != n.mediaAsset ||
          o.replyToText != n.replyToText ||
          o.replyToSender != n.replyToSender ||
          o.isPaymentVerified != n.isPaymentVerified) {
        return true;
      }
    }
    return false;
  }

  bool _isDifferentDay(DateTime? a, DateTime? b) {
    if (a == null || b == null) return false;
    return a.year != b.year || a.month != b.month || a.day != b.day;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopChatPolling();
    _recordTimer?.cancel();
    _audioRecorder.dispose();
    _scrollController.removeListener(_onScroll);
    _msgController.dispose();
    _scrollController.dispose();
    _isNearBottomNotifier.dispose();
    _unseenCountNotifier.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _sendMessage({
    String? customText,
    MessageType type = MessageType.text,
    String? mediaAsset,
    String? mediaName,
    String? mediaSize,
    bool isForwarded = false,
    String? audioDuration,
  }) {
    final text = customText ?? _msgController.text.trim();
    if (text.isEmpty && mediaAsset == null && type != MessageType.audio) return;

    final replyText = _replyingToMessage?.text.isNotEmpty == true
        ? _replyingToMessage!.text
        : _replyingToMessage?.mediaName;
    final replySender = _replyingToMessage != null
        ? (_replyingToMessage!.isOutgoing ? 'You' : _conversation.name)
        : null;
    final replyId = _replyingToMessage?.id;

    if (_replyingToMessage != null) {
      setState(() => _replyingToMessage = null);
    }

    final newMsg = WhatsAppMessage(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      text: text,
      timestamp: 'Now',
      rawTimestamp: DateTime.now(),
      isOutgoing: true,
      status: MessageStatus.sent,
      type: type,
      mediaAsset: mediaAsset,
      mediaName: mediaName,
      mediaSize: mediaSize,
      replyToText: replyText,
      replyToSender: replySender,
      replyToId: replyId,
      isForwarded: isForwarded,
      audioDuration: audioDuration,
    );

    setState(() {
      _conversation = _conversation.copyWith(
        lastMessage: text.isNotEmpty ? text : (mediaName ?? 'Media Attachment'),
        time: 'Now',
        unreadCount: 0,
        messages: [..._conversation.messages, newMsg],
      );
    });

    if (customText == null) {
      _msgController.clear();
    }
    _scrollToBottom();

    String? mimeType;
    if (type == MessageType.image) {
      mimeType = 'image/jpeg';
    } else if (type == MessageType.video) {
      mimeType = 'video/mp4';
    } else if (type == MessageType.document) {
      mimeType = 'application/pdf';
    } else if (type == MessageType.audio) {
      mimeType = 'audio/mp3';
    }

    // Call live backend API in background
    WhatsAppService.sendMessage(
      phone: _conversation.phone,
      message: text,
      mediaData: mediaAsset,
      mimeType: mimeType,
      replyToChatId: replyId,
      isForwarded: isForwarded,
    );
  }

  /// Sends multiple media items and/or message body sequentially for Quick Replies
  Future<void> _sendQuickReply(WhatsAppQuickReply reply) async {
    final List<Map<String, String>> mediaList = [];
    if (reply.mediaUrls.isNotEmpty) {
      for (int i = 0; i < reply.mediaUrls.length; i++) {
        final url = reply.mediaUrls[i];
        final type = i < reply.mediaTypes.length ? reply.mediaTypes[i] : 'image';
        final name = i < reply.mediaNames.length ? reply.mediaNames[i] : url.split('/').last.split('\\').last;
        mediaList.add({'url': url, 'type': type, 'name': name});
      }
    } else if (reply.hasMedia && reply.mediaUrl != null && reply.mediaUrl!.isNotEmpty) {
      mediaList.add({
        'url': reply.mediaUrl!,
        'type': reply.mediaType,
        'name': reply.mediaName ?? reply.mediaUrl!.split('/').last.split('\\').last,
      });
    }

    if (mediaList.isEmpty) {
      if (reply.body.isNotEmpty) {
        _sendMessage(customText: reply.body, type: MessageType.text);
      }
      return;
    }

    // Sequentially send each media attachment with brief intervals
    for (int i = 0; i < mediaList.length; i++) {
      final item = mediaList[i];
      final typeStr = item['type'] ?? 'image';
      MessageType mType = MessageType.image;
      if (typeStr == 'video') {
        mType = MessageType.video;
      } else if (typeStr == 'document') {
        mType = MessageType.document;
      }

      // First media item carries the optional text body as a caption
      final caption = (i == 0 && reply.body.isNotEmpty) ? reply.body : null;

      _sendMessage(
        customText: caption,
        type: mType,
        mediaAsset: item['url'],
        mediaName: item['name'],
      );

      if (i < mediaList.length - 1) {
        await Future.delayed(const Duration(milliseconds: 180));
      }
    }
  }

  void _openQuickRepliesSheet() {
    WhatsAppQuickRepliesSheet.show(
      context,
      onSelectReply: (reply) async {
        await _sendQuickReply(reply);
      },
    );
  }

  Future<void> _pickFromCamera() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
      if (file != null) {
        _sendMessage(
          type: MessageType.image,
          mediaAsset: file.path,
          mediaName: file.name,
        );
      }
    } catch (e) {
      debugPrint('Camera pick error: $e');
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (file != null) {
        _sendMessage(
          type: MessageType.image,
          mediaAsset: file.path,
          mediaName: file.name,
        );
      }
    } catch (e) {
      debugPrint('Gallery pick error: $e');
    }
  }

  void _showQuickPaymentDialog() {
    final amountCtrl = TextEditingController(text: '12000');
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.currency_rupee_rounded, color: Color(0xFF008069)),
              SizedBox(width: 8),
              Text('Request UPI Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Send UPI payment request to ${_conversation.name} (${_conversation.phone}):',
                style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Amount (₹)',
                  prefixText: '₹ ',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                final amt = amountCtrl.text.trim();
                final displayAmt = amt.isNotEmpty ? '₹$amt' : '₹12,000';
                _sendMessage(
                  customText: 'Please complete your booking payment of $displayAmt via UPI ID: sgbagro@icici.\nAfter paying, please share the payment screenshot here for instant verification.',
                  type: MessageType.template,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF008069),
                foregroundColor: Colors.white,
              ),
              child: const Text('Send Payment Request'),
            ),
          ],
        );
      },
    );
  }

  void _openAttachmentSheet() {
    WhatsAppAttachmentSheet.show(
      context,
      onOptionSelected: (type) {
        if (type == 'Camera') {
          _pickFromCamera();
        } else if (type == 'Gallery') {
          _pickFromGallery();
        } else if (type == 'Payment') {
          _showQuickPaymentDialog();
        } else if (type == 'QuickReplies') {
          _openQuickRepliesSheet();
        } else if (type == 'Catalogue') {
          _sendMessage(
            customText: 'Here is the SGB Agro Organic Fertilizers & Power Tillers Catalogue 2024:',
            type: MessageType.document,
            mediaName: 'SGB_Product_Catalogue_2024.pdf',
            mediaSize: '3.2 MB',
          );
        } else if (type == 'Document') {
          _pickFromGallery();
        } else if (type == 'Audio') {
          _startAudioRecording();
        } else {
          _sendMessage(customText: 'Shared $type attachment');
        }
      },
    );
  }

  // Voice Note Recording Methods with Real Microphone Capture
  Future<void> _startAudioRecording() async {
    try {
      final hasPermission = await _audioRecorder.hasPermission();
      if (!hasPermission) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Microphone permission required to record voice notes'),
            backgroundColor: Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      _recordedAudioPath = filePath;

      await _audioRecorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: filePath,
      );

      if (mounted) {
        setState(() {
          _isRecordingAudio = true;
          _recordSeconds = 0;
        });
      }

      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) {
          setState(() => _recordSeconds++);
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Microphone error: $e'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _cancelAudioRecording() async {
    _recordTimer?.cancel();
    try {
      await _audioRecorder.stop();
      if (_recordedAudioPath != null) {
        final f = File(_recordedAudioPath!);
        if (await f.exists()) await f.delete();
      }
    } catch (_) {}

    if (mounted) {
      setState(() {
        _isRecordingAudio = false;
        _recordSeconds = 0;
        _recordedAudioPath = null;
      });
    }
  }

  Future<void> _sendAudioRecording() async {
    _recordTimer?.cancel();
    String? path;
    try {
      path = await _audioRecorder.stop();
    } catch (_) {
      path = _recordedAudioPath;
    }

    final durationSecs = _recordSeconds;
    final durationStr = '${(durationSecs ~/ 60).toString().padLeft(2, '0')}:${(durationSecs % 60).toString().padLeft(2, '0')}';

    setState(() {
      _isRecordingAudio = false;
      _recordSeconds = 0;
      _recordedAudioPath = null;
    });

    if (path != null && File(path).existsSync()) {
      _sendMessage(
        type: MessageType.audio,
        mediaAsset: path,
        mediaName: 'Voice Note ($durationStr).m4a',
        mediaSize: '${(File(path).lengthSync() / 1024).toStringAsFixed(1)} KB',
        audioDuration: durationStr,
        customText: '', // Real voice note: no fake text!
      );
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No audio recorded'),
            backgroundColor: Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  // Message Actions
  void _deleteSelectedMessage(bool forEveryone) {
    if (_selectedMessage == null) return;
    final msg = _selectedMessage!;
    setState(() {
      _conversation = _conversation.copyWith(
        messages: _conversation.messages.where((m) => m.id != msg.id).toList(),
      );
      _selectedMessage = null;
    });

    if (forEveryone && !msg.id.startsWith('msg_')) {
      WhatsAppService.deleteMessage(msg.id, forEveryone: true);
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(forEveryone ? 'Message deleted for everyone' : 'Message deleted for you'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showDeleteDialog() {
    if (_selectedMessage == null) return;
    final msg = _selectedMessage!;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete message?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _deleteSelectedMessage(false);
            },
            child: const Text('Delete for me', style: TextStyle(color: Color(0xFFDC2626))),
          ),
          if (msg.isOutgoing)
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _deleteSelectedMessage(true);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              child: const Text('Delete for everyone'),
            ),
        ],
      ),
    );
  }

  void _forwardSelectedMessage() {
    if (_selectedMessage == null) return;
    final msg = _selectedMessage!;
    _sendMessage(
      customText: msg.text,
      type: msg.type,
      mediaAsset: msg.mediaAsset,
      mediaName: msg.mediaName,
      isForwarded: true,
    );
    setState(() => _selectedMessage = null);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Message forwarded'),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Color(0xFF008069),
      ),
    );
  }

  void _resolveHandoff() {
    setState(() => _isHandoffActive = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Handoff resolved. Bot paused and you are in direct conversation.'),
        backgroundColor: Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _retriggerBot() {
    setState(() => _isHandoffActive = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('AI Chatbot re-triggered for this customer conversation.'),
        backgroundColor: Color(0xFF2563EB),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _verifyPayment() {
    setState(() {
      _isPaymentPending = false;
      _conversation = _conversation.copyWith(
        isPaymentPending: false,
        lastMessage: 'Payment verified & order confirmed',
        messages: _conversation.messages.map((m) {
          if (m.type == MessageType.paymentProof) {
            return m.copyWith(isPaymentVerified: true);
          }
          return m;
        }).toList(),
      );
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment verified! Order marked as CONFIRMED in CRM.'),
        backgroundColor: Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _rejectPayment() {
    setState(() => _isPaymentPending = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment rejected. Customer requested to re-upload clear receipt.'),
        backgroundColor: Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _callViaAcefone() {
    final messenger = ScaffoldMessenger.of(context);
    final name = _conversation.name;
    final phone = _conversation.phone;

    String? leadId;
    if (_conversation.id.startsWith('lead_')) {
      leadId = _conversation.id.replaceFirst('lead_', '');
    } else {
      final parsed = int.tryParse(_conversation.id);
      if (parsed != null && parsed < 1000000000) {
        leadId = _conversation.id;
      }
    }

    messenger.showSnackBar(
      SnackBar(
        content: Text('Dialing $name ($phone) via Acefone...'),
        backgroundColor: const Color(0xFF008069),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'DISCONNECT',
          textColor: const Color(0xFFDCFCE7),
          onPressed: () {
            messenger.hideCurrentSnackBar();
          },
        ),
      ),
    );

    TelephonyService.initiateClickToCall(
      leadId: leadId,
      destinationPhone: phone,
    ).then((result) {
      if (!mounted) return;
      if (result.success) {
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '📞 Acefone Click-to-Call Connected! Your agent phone/extension is ringing now.',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
          ),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(result.message ?? 'Acefone call initiation failed'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isSelecting = _selectedMessage != null;

    return PopScope(
      canPop: !isSelecting,
      onPopInvokedWithResult: (didPop, result) {
        if (isSelecting) {
          setState(() => _selectedMessage = null);
        } else if (!didPop) {
          Navigator.of(context).pop(_conversation);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFEFEAE2),
        appBar: isSelecting ? _buildSelectionAppBar() : _buildNormalAppBar(),
        body: Column(
          children: [
            if (_isLoadingHistory && _conversation.messages.isEmpty)
              const LinearProgressIndicator(
                minHeight: 2.5,
                backgroundColor: Color(0xFFE2E8F0),
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF008069)),
              ),

            // 1. Human Handoff Banner
            if (_isHandoffActive)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: const BoxDecoration(
                  color: Color(0xFFFEF2F2),
                  border: Border(bottom: BorderSide(color: Color(0xFFFECACA))),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Customer requested Human Handoff',
                        style: TextStyle(
                          color: Color(0xFF991B1B),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _resolveHandoff,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Start Chat', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 6),
                    OutlinedButton(
                      onPressed: _retriggerBot,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF2563EB),
                        side: const BorderSide(color: Color(0xFF93C5FD)),
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Re-Bot', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),

            // 2. Payment Verification Header Alert
            if (_isPaymentPending)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: const BoxDecoration(
                  color: Color(0xFFF0FDF4),
                  border: Border(bottom: BorderSide(color: Color(0xFFBBF7D0))),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.receipt_long_rounded, color: Color(0xFF16A34A), size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'UPI Payment screenshot pending review',
                        style: TextStyle(
                          color: Color(0xFF166534),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _verifyPayment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Verify', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),

            // 3. Dynamic 24h Meta Window Pill
            _build24hWindowPill(),

            // 4. Messages Stream with Date Separator Chips
            Expanded(
              child: Stack(
                children: [
                  _isLoadingHistory && _conversation.messages.isEmpty
                      ? _buildChatSkeleton()
                      : (_conversation.messages.isEmpty
                          ? const Center(
                              child: Text(
                                'No messages yet in conversation',
                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13.5),
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollController,
                              physics: const ClampingScrollPhysics(),
                              cacheExtent: 350,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              itemCount: _conversation.messages.length,
                              itemBuilder: (context, index) {
                                final msg = _conversation.messages[index];
                                final prevMsg = index > 0 ? _conversation.messages[index - 1] : null;

                                final bool showDateSeparator = index == 0 ||
                                    _isDifferentDay(msg.rawTimestamp, prevMsg?.rawTimestamp);

                                return KeyedSubtree(
                                  key: ValueKey(msg.id),
                                  child: RepaintBoundary(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (showDateSeparator && msg.rawTimestamp != null)
                                          WhatsAppDateSeparator(date: msg.rawTimestamp!),
                                        WhatsAppMessageBubble(
                                          message: msg,
                                          isSelected: _selectedMessage?.id == msg.id,
                                          onLongPress: () {
                                            HapticFeedback.mediumImpact();
                                            setState(() => _selectedMessage = msg);
                                          },
                                          onTap: () {
                                            if (_selectedMessage != null) {
                                              setState(() {
                                                _selectedMessage = _selectedMessage?.id == msg.id ? null : msg;
                                              });
                                            }
                                          },
                                          onTemplateActionPressed: (actionLabel) {
                                            _sendMessage(customText: 'Selected: $actionLabel');
                                          },
                                          onVerifyPayment: _verifyPayment,
                                          onRejectPayment: _rejectPayment,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            )),

                  // Floating Jump-Down Arrow [↓] Button (isolated with ValueListenableBuilder: 0 rebuilds on scroll)
                  ValueListenableBuilder<bool>(
                    valueListenable: _isNearBottomNotifier,
                    builder: (context, isNearBottom, _) {
                      if (isNearBottom) return const SizedBox.shrink();
                      return Positioned(
                        bottom: 12,
                        right: 16,
                        child: ValueListenableBuilder<int>(
                          valueListenable: _unseenCountNotifier,
                          builder: (context, unseenCount, _) {
                            return GestureDetector(
                              onTap: () {
                                _isUserNearBottom = true;
                                _isNearBottomNotifier.value = true;
                                _unseenNewMessagesCount = 0;
                                _unseenCountNotifier.value = 0;
                                _scrollToBottom();
                              },
                              child: Container(
                                padding: EdgeInsets.symmetric(
                                  horizontal: unseenCount > 0 ? 12 : 8,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(24),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.18),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF008069), size: 24),
                                    if (unseenCount > 0) ...[
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF25D366),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Text(
                                          '$unseenCount',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            // 5. Quoted Reply Preview Banner (when replying to a message)
            if (_replyingToMessage != null) _buildQuotedReplyPreview(),

            // 6. Input Bar or Audio Recording Bar
            _isRecordingAudio ? _buildAudioRecordingBar() : _buildStandardInputBar(),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildNormalAppBar() {
    return AppBar(
      backgroundColor: const Color(0xFF008069),
      foregroundColor: Colors.white,
      elevation: 1,
      titleSpacing: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, size: 23),
        onPressed: () => Navigator.of(context).pop(_conversation),
      ),
      title: GestureDetector(
        onTap: () => WhatsAppContactDetailsSheet.show(context, conversation: _conversation),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _conversation.avatarBgColor,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  _conversation.initials,
                  style: TextStyle(
                    color: _conversation.avatarTextColor,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _conversation.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    _conversation.phone,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFFD1FAE5),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        IconButton(
          onPressed: _callViaAcefone,
          icon: const Icon(Icons.phone_rounded, size: 21),
          tooltip: 'Acefone Call',
        ),
        IconButton(
          onPressed: () => WhatsAppContactDetailsSheet.show(context, conversation: _conversation),
          icon: const Icon(Icons.info_outline_rounded, size: 21),
          tooltip: 'Lead Details',
        ),
        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert_rounded, size: 21),
          onSelected: (val) {
            if (val == 'view_lead') {
              Navigator.of(context).pushNamed('/lead-details', arguments: _conversation.id);
            } else if (val == 'clear') {
              setState(() {
                _conversation = WhatsAppConversation(
                  id: _conversation.id,
                  name: _conversation.name,
                  phone: _conversation.phone,
                  lastMessage: 'Chat cleared',
                  time: 'Now',
                  avatarBgColor: _conversation.avatarBgColor,
                  avatarTextColor: _conversation.avatarTextColor,
                  messages: const [],
                );
              });
            }
          },
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'view_lead', child: Text('Open Full Lead in CRM')),
            const PopupMenuItem(value: 'media', child: Text('Media, links, and docs')),
            const PopupMenuItem(value: 'search', child: Text('Search in chat')),
            const PopupMenuItem(value: 'clear', child: Text('Clear chat history')),
          ],
        ),
      ],
    );
  }

  PreferredSizeWidget _buildSelectionAppBar() {
    return AppBar(
      backgroundColor: const Color(0xFF008069),
      foregroundColor: Colors.white,
      elevation: 2,
      leading: IconButton(
        icon: const Icon(Icons.close_rounded, size: 24),
        onPressed: () => setState(() => _selectedMessage = null),
      ),
      title: const Text('1', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      actions: [
        // Reply Action
        IconButton(
          icon: const Icon(Icons.reply_rounded, size: 22),
          tooltip: 'Reply',
          onPressed: () {
            setState(() {
              _replyingToMessage = _selectedMessage;
              _selectedMessage = null;
            });
          },
        ),
        // Forward Action
        IconButton(
          icon: const Icon(Icons.forward_rounded, size: 22),
          tooltip: 'Forward',
          onPressed: _forwardSelectedMessage,
        ),
        // Copy Action
        IconButton(
          icon: const Icon(Icons.content_copy_rounded, size: 20),
          tooltip: 'Copy',
          onPressed: () {
            if (_selectedMessage?.text.isNotEmpty == true) {
              Clipboard.setData(ClipboardData(text: _selectedMessage!.text));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Message copied'), behavior: SnackBarBehavior.floating),
              );
            }
            setState(() => _selectedMessage = null);
          },
        ),
        // Delete Action
        IconButton(
          icon: const Icon(Icons.delete_rounded, size: 22),
          tooltip: 'Delete',
          onPressed: _showDeleteDialog,
        ),
      ],
    );
  }

  Widget _buildQuotedReplyPreview() {
    final sender = _replyingToMessage!.isOutgoing ? 'You' : _conversation.name;
    final snippet = _replyingToMessage!.text.isNotEmpty
        ? _replyingToMessage!.text
        : (_replyingToMessage!.mediaName ?? 'Media Attachment');

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 10, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFF008069),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  sender,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF008069)),
                ),
                const SizedBox(height: 2),
                Text(
                  snippet,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF64748B)),
            onPressed: () => setState(() => _replyingToMessage = null),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  Widget _buildAudioRecordingBar() {
    final minutes = (_recordSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (_recordSeconds % 60).toString().padLeft(2, '0');

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 4,
            offset: Offset(0, -1),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Blinking Recording Dot
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: Color(0xFFDC2626),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$minutes:$seconds',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF111B21)),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _cancelAudioRecording,
              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 20),
              label: const Text('Cancel', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _sendAudioRecording,
              child: Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFF008069),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStandardInputBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
      decoration: const BoxDecoration(
        color: Colors.transparent,
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Pill Container
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Emoji button
                    IconButton(
                      onPressed: () {
                        _msgController.text += '👍';
                        setState(() {});
                      },
                      icon: const Icon(
                        Icons.sentiment_satisfied_alt_outlined,
                        color: Color(0xFF8696A0),
                        size: 24,
                      ),
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                      splashRadius: 20,
                    ),

                    // Message Input Field
                    Expanded(
                      child: TextField(
                        controller: _msgController,
                        maxLines: 5,
                        minLines: 1,
                        cursorColor: const Color(0xFF008069),
                        style: const TextStyle(
                          fontSize: 16,
                          color: Color(0xFF111B21),
                        ),
                        onChanged: (val) {
                          if (val.trim() == '/') {
                            _msgController.clear();
                            _openQuickRepliesSheet();
                          }
                          setState(() {});
                        },
                        onSubmitted: (_) => _sendMessage(),
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          hintStyle: TextStyle(
                            fontSize: 16,
                            color: Color(0xFF8696A0),
                            fontWeight: FontWeight.w400,
                          ),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 9, horizontal: 4),
                        ),
                      ),
                    ),

                    // Attachment Paperclip button
                    IconButton(
                      onPressed: _openAttachmentSheet,
                      icon: Transform.rotate(
                        angle: -0.6,
                        child: const Icon(
                          Icons.attach_file_rounded,
                          color: Color(0xFF8696A0),
                          size: 24,
                        ),
                      ),
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                      splashRadius: 20,
                    ),

                    // When text is empty: show Rupee and Camera inside the pill
                    if (_msgController.text.trim().isEmpty) ...[
                      IconButton(
                        onPressed: _showQuickPaymentDialog,
                        icon: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFF8696A0), width: 1.5),
                          ),
                          child: const Center(
                            child: Text(
                              '₹',
                              style: TextStyle(
                                color: Color(0xFF8696A0),
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                height: 1.1,
                              ),
                            ),
                          ),
                        ),
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                        splashRadius: 20,
                        tooltip: 'UPI Payment',
                      ),
                      IconButton(
                        onPressed: _pickFromCamera,
                        icon: const Icon(
                          Icons.camera_alt_rounded,
                          color: Color(0xFF8696A0),
                          size: 23,
                        ),
                        padding: const EdgeInsets.all(8),
                        constraints: const BoxConstraints(),
                        splashRadius: 20,
                        tooltip: 'Camera',
                      ),
                    ],
                  ],
                ),
              ),
            ),

            const SizedBox(width: 6),

            // Send / Mic Floating Circle
            GestureDetector(
              onTap: () {
                if (_msgController.text.trim().isNotEmpty) {
                  _sendMessage();
                } else {
                  _startAudioRecording();
                }
              },
              child: Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: Color(0xFF008069),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Icon(
                    _msgController.text.trim().isNotEmpty
                        ? Icons.send_rounded
                        : Icons.mic_rounded,
                    color: Colors.white,
                    size: _msgController.text.trim().isNotEmpty ? 20 : 23,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _build24hWindowPill() {
    final hours = _conversation.dynamicWindowHoursLeft;
    final isOpen = _conversation.isDynamic24hActive && hours > 0;

    final Color bgColor = isOpen
        ? (hours <= 2 ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7))
        : const Color(0xFFF1F5F9);
    final Color borderColor = isOpen
        ? (hours <= 2 ? const Color(0xFFFDE68A) : const Color(0xFF86EFAC))
        : const Color(0xFFCBD5E1);
    final Color textColor = isOpen
        ? (hours <= 2 ? const Color(0xFF92400E) : const Color(0xFF166534))
        : const Color(0xFF64748B);
    final IconData icon = isOpen
        ? (hours <= 2 ? Icons.hourglass_bottom_rounded : Icons.lock_clock_rounded)
        : Icons.lock_outline_rounded;
    final String text = isOpen
        ? '24h Customer Window Open • ${hours}h remaining'
        : '24h Session Expired • Template Required';

    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: textColor),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatSkeleton() {
    return ShimmerLoadingScope(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: const [
          Align(
            alignment: Alignment.centerLeft,
            child: ShimmerBox(width: 220, height: 48, borderRadius: 16),
          ),
          SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ShimmerBox(width: 180, height: 40, borderRadius: 16),
          ),
          SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: ShimmerBox(width: 250, height: 56, borderRadius: 16),
          ),
          SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ShimmerBox(width: 200, height: 44, borderRadius: 16),
          ),
        ],
      ),
    );
  }
}
