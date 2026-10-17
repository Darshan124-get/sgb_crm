import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../data/services/quick_replies_storage_service.dart';
import '../../domain/models/whatsapp_model.dart';

class WhatsAppQuickRepliesSheet extends StatefulWidget {
  final ValueChanged<WhatsAppQuickReply> onSelectReply;

  const WhatsAppQuickRepliesSheet({
    super.key,
    required this.onSelectReply,
  });

  static void show(BuildContext context, {required ValueChanged<WhatsAppQuickReply> onSelectReply}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => WhatsAppQuickRepliesSheet(onSelectReply: onSelectReply),
    );
  }

  @override
  State<WhatsAppQuickRepliesSheet> createState() => _WhatsAppQuickRepliesSheetState();
}

class _WhatsAppQuickRepliesSheetState extends State<WhatsAppQuickRepliesSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  List<WhatsAppQuickReply> _replies = [];
  bool _isLoading = true;
  String _selectedCategory = 'All';

  @override
  void initState() {
    super.initState();
    _loadReplies();
  }

  Future<void> _loadReplies() async {
    final list = await QuickRepliesStorageService.getQuickReplies();
    if (mounted) {
      setState(() {
        _replies = list;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<String> get _categories {
    final set = <String>{'All'};
    for (final r in _replies) {
      final cat = r.category.trim();
      if (cat.isNotEmpty && cat.toLowerCase() != 'general') {
        set.add(cat);
      }
    }
    return set.toList();
  }

  List<String> get _existingUserCategories {
    final set = <String>{};
    for (final r in _replies) {
      final cat = r.category.trim();
      if (cat.isNotEmpty && cat.toLowerCase() != 'general') {
        set.add(cat);
      }
    }
    return set.toList();
  }

  void _showEditorDialog([WhatsAppQuickReply? existing]) {
    final isEditing = existing != null;
    final shortcutCtrl = TextEditingController(text: existing?.shortcut ?? '');
    final titleCtrl = TextEditingController(text: existing?.title ?? '');
    final categoryCtrl = TextEditingController(
      text: (existing != null && existing.category.toLowerCase() != 'general') ? existing.category : '',
    );
    final bodyCtrl = TextEditingController(text: existing?.body ?? '');
    final customUrlCtrl = TextEditingController();

    final List<_QuickReplyMediaItem> mediaItems = [];
    if (existing != null) {
      if (existing.mediaUrls.isNotEmpty) {
        for (int i = 0; i < existing.mediaUrls.length; i++) {
          final url = existing.mediaUrls[i];
          final type = i < existing.mediaTypes.length ? existing.mediaTypes[i] : 'image';
          final name = i < existing.mediaNames.length ? existing.mediaNames[i] : url.split('/').last.split('\\').last;
          mediaItems.add(_QuickReplyMediaItem(path: url, name: name, type: type));
        }
      } else if (existing.hasMedia && existing.mediaUrl != null && existing.mediaUrl!.isNotEmpty) {
        mediaItems.add(_QuickReplyMediaItem(
          path: existing.mediaUrl!,
          name: existing.mediaName ?? existing.mediaUrl!.split('/').last.split('\\').last,
          type: existing.mediaType,
        ));
      }
    }

    final picker = ImagePicker();

    Future<void> pickPhotos(StateSetter setDialogState) async {
      try {
        final List<XFile> files = await picker.pickMultiImage(imageQuality: 85);
        if (files.isNotEmpty) {
          setDialogState(() {
            for (final f in files) {
              mediaItems.add(_QuickReplyMediaItem(path: f.path, name: f.name, type: 'image'));
            }
          });
        }
      } catch (e) {
        debugPrint('Photos pick error: $e');
      }
    }

    Future<void> pickVideo(StateSetter setDialogState) async {
      try {
        final XFile? file = await picker.pickVideo(source: ImageSource.gallery);
        if (file != null) {
          setDialogState(() {
            mediaItems.add(_QuickReplyMediaItem(path: file.path, name: file.name, type: 'video'));
          });
        }
      } catch (e) {
        debugPrint('Video pick error: $e');
      }
    }

    Future<void> pickCamera(StateSetter setDialogState, {bool isVideo = false}) async {
      try {
        final XFile? file = isVideo
            ? await picker.pickVideo(source: ImageSource.camera)
            : await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
        if (file != null) {
          setDialogState(() {
            mediaItems.add(_QuickReplyMediaItem(
              path: file.path,
              name: file.name,
              type: isVideo ? 'video' : 'image',
            ));
          });
        }
      } catch (e) {
        debugPrint('Camera pick error: $e');
      }
    }

    Future<void> pickGeneralFile(StateSetter setDialogState) async {
      try {
        final XFile? file = await picker.pickMedia();
        if (file != null) {
          final lower = file.name.toLowerCase();
          String mType = 'image';
          if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.mkv')) {
            mType = 'video';
          } else if (lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx')) {
            mType = 'document';
          }
          setDialogState(() {
            mediaItems.add(_QuickReplyMediaItem(path: file.path, name: file.name, type: mType));
          });
        }
      } catch (e) {
        debugPrint('Media pick error: $e');
      }
    }

    void addCustomUrl(StateSetter setDialogState) {
      final raw = customUrlCtrl.text.trim();
      if (raw.isEmpty) return;
      final lower = raw.toLowerCase();
      String mType = 'image';
      if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.mkv')) {
        mType = 'video';
      } else if (lower.endsWith('.pdf') || lower.endsWith('.doc')) {
        mType = 'document';
      }
      final name = raw.split('/').last.split('\\').last.split('?').first;
      setDialogState(() {
        mediaItems.add(_QuickReplyMediaItem(path: raw, name: name.isNotEmpty ? name : 'Web Media', type: mType));
        customUrlCtrl.clear();
      });
    }

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final userCats = _existingUserCategories;

            return Theme(
              data: ThemeData(
                brightness: Brightness.light,
                useMaterial3: true,
                colorScheme: const ColorScheme.light(
                  primary: Color(0xFF008069),
                  surface: Colors.white,
                  onSurface: Color(0xFF111B21),
                ),
                dialogTheme: const DialogTheme(
                  backgroundColor: Colors.white,
                  surfaceTintColor: Colors.transparent,
                ),
                scaffoldBackgroundColor: Colors.white,
                cardColor: Colors.white,
              ),
              child: Dialog(
                backgroundColor: Colors.white,
                surfaceTintColor: Colors.transparent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                clipBehavior: Clip.antiAlias,
                child: Container(
                  color: Colors.white,
                  width: double.infinity,
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Header Row
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 20, 16, 12),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFE8F5E9),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isEditing ? Icons.edit_rounded : Icons.add_comment_rounded,
                                  color: const Color(0xFF008069),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isEditing ? 'Edit Quick Reply' : 'Create Quick Reply',
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF111B21),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text(
                                      'All fields optional • Attach multiple photos & videos',
                                      style: TextStyle(fontSize: 11.5, color: Color(0xFF667781)),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                                onPressed: () => Navigator.pop(ctx),
                                splashRadius: 18,
                              ),
                            ],
                          ),
                        ),

                        const Divider(height: 1, color: Color(0xFFF1F5F9)),

                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Shortcut input (Optional)
                              TextField(
                                controller: shortcutCtrl,
                                style: const TextStyle(color: Color(0xFF111B21), fontSize: 14, fontWeight: FontWeight.w600),
                                decoration: InputDecoration(
                                  labelText: 'Shortcut (Optional)',
                                  labelStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                                  hintText: '/greeting, /video (auto-generated if empty)',
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                  prefixIcon: const Icon(Icons.bolt_rounded, size: 20, color: Color(0xFF008069)),
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFF008069), width: 1.6),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Title input (Optional)
                              TextField(
                                controller: titleCtrl,
                                style: const TextStyle(color: Color(0xFF111B21), fontSize: 14),
                                decoration: InputDecoration(
                                  labelText: 'Template Title (Optional)',
                                  labelStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                                  hintText: 'e.g. Blade Protector Video Demo',
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                  prefixIcon: const Icon(Icons.title_rounded, size: 20, color: Color(0xFF64748B)),
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFF008069), width: 1.6),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Category input (Optional)
                              TextField(
                                controller: categoryCtrl,
                                style: const TextStyle(color: Color(0xFF111B21), fontSize: 14),
                                decoration: InputDecoration(
                                  labelText: 'Category (Optional)',
                                  labelStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                                  hintText: 'e.g. Offers, Products, Support',
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                  prefixIcon: const Icon(Icons.label_outline_rounded, size: 20, color: Color(0xFF64748B)),
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFF008069), width: 1.6),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                ),
                              ),
                              if (userCats.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 6,
                                  children: userCats.map((cat) {
                                    return ActionChip(
                                      backgroundColor: const Color(0xFFF1F5F9),
                                      label: Text(cat, style: const TextStyle(fontSize: 11, color: Color(0xFF0F172A))),
                                      onPressed: () {
                                        setDialogState(() {
                                          categoryCtrl.text = cat;
                                        });
                                      },
                                    );
                                  }).toList(),
                                ),
                              ],
                              const SizedBox(height: 12),

                              // Message Body input (Optional)
                              TextField(
                                controller: bodyCtrl,
                                maxLines: 3,
                                style: const TextStyle(color: Color(0xFF111B21), fontSize: 14),
                                decoration: InputDecoration(
                                  labelText: 'Message Body / Caption (Optional)',
                                  labelStyle: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                                  hintText: 'Type your message text or photo caption here...',
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: Color(0xFF008069), width: 1.6),
                                  ),
                                  contentPadding: const EdgeInsets.all(14),
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Multi-Media Attachment Section
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Media Attachments',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111B21)),
                                  ),
                                  if (mediaItems.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFDCFCE7),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '${mediaItems.length} attached',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF166534)),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 8),

                              // Pick Media Buttons Row
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  ElevatedButton.icon(
                                    onPressed: () => pickPhotos(setDialogState),
                                    icon: const Icon(Icons.photo_library_rounded, size: 16, color: Colors.white),
                                    label: const Text('Add Images', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF008069),
                                      elevation: 0,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                  ElevatedButton.icon(
                                    onPressed: () => pickVideo(setDialogState),
                                    icon: const Icon(Icons.video_library_rounded, size: 16, color: Colors.white),
                                    label: const Text('Add Video', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0F766E),
                                      elevation: 0,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => pickCamera(setDialogState, isVideo: false),
                                    icon: const Icon(Icons.camera_alt_rounded, size: 15, color: Color(0xFF008069)),
                                    label: const Text('Photo Camera', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF008069))),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: Color(0xFF008069), width: 1.2),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => pickCamera(setDialogState, isVideo: true),
                                    icon: const Icon(Icons.videocam_rounded, size: 15, color: Color(0xFF0F766E)),
                                    label: const Text('Record Video', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0F766E))),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: Color(0xFF0F766E), width: 1.2),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => pickGeneralFile(setDialogState),
                                    icon: const Icon(Icons.attach_file_rounded, size: 15, color: Color(0xFF475569)),
                                    label: const Text('Files / Doc', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                  ),
                                ],
                              ),

                              // Horizontal List of Attached Media Cards
                              if (mediaItems.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SizedBox(
                                        height: 90,
                                        child: ListView.separated(
                                          scrollDirection: Axis.horizontal,
                                          itemCount: mediaItems.length,
                                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                                          itemBuilder: (ctx, idx) {
                                            final m = mediaItems[idx];
                                            final isLocal = !m.path.startsWith('http') && File(m.path).existsSync();

                                            return Stack(
                                              clipBehavior: Clip.none,
                                              children: [
                                                Container(
                                                  width: 80,
                                                  height: 90,
                                                  decoration: BoxDecoration(
                                                    color: Colors.white,
                                                    borderRadius: BorderRadius.circular(10),
                                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                                  ),
                                                  clipBehavior: Clip.antiAlias,
                                                  child: Column(
                                                    children: [
                                                      Expanded(
                                                        child: m.type == 'image'
                                                            ? (isLocal
                                                                ? Image.file(File(m.path), fit: BoxFit.cover, width: double.infinity)
                                                                : (m.path.startsWith('http')
                                                                    ? Image.network(m.path, fit: BoxFit.cover, width: double.infinity)
                                                                    : Container(
                                                                        color: const Color(0xFFDCFCE7),
                                                                        child: const Center(child: Icon(Icons.image, color: Color(0xFF16A34A), size: 24)),
                                                                      )))
                                                            : (m.type == 'video'
                                                                ? Container(
                                                                    color: const Color(0xFF0F172A),
                                                                    child: const Center(child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 28)),
                                                                  )
                                                                : Container(
                                                                    color: const Color(0xFFFEF3C7),
                                                                    child: const Center(child: Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFB45309), size: 26)),
                                                                  )),
                                                      ),
                                                      Container(
                                                        width: double.infinity,
                                                        color: const Color(0xFFF1F5F9),
                                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                        child: Text(
                                                          m.name,
                                                          maxLines: 1,
                                                          overflow: TextOverflow.ellipsis,
                                                          textAlign: TextAlign.center,
                                                          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Positioned(
                                                  top: -5,
                                                  right: -5,
                                                  child: GestureDetector(
                                                    onTap: () {
                                                      setDialogState(() {
                                                        mediaItems.removeAt(idx);
                                                      });
                                                    },
                                                    child: Container(
                                                      padding: const EdgeInsets.all(2),
                                                      decoration: const BoxDecoration(
                                                        color: Color(0xFFDC2626),
                                                        shape: BoxShape.circle,
                                                      ),
                                                      child: const Icon(Icons.close, size: 14, color: Colors.white),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            );
                                          },
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        '${mediaItems.length} item(s) will be sent sequentially when quick reply is selected.',
                                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              const SizedBox(height: 10),

                              // Custom URL / Network Media Link row
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: customUrlCtrl,
                                      style: const TextStyle(color: Color(0xFF111B21), fontSize: 12.5),
                                      decoration: InputDecoration(
                                        hintText: 'Or enter URL: https://.../image.jpg',
                                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                                        prefixIcon: const Icon(Icons.link_rounded, size: 18, color: Color(0xFF64748B)),
                                        filled: true,
                                        fillColor: const Color(0xFFF8FAFC),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                        ),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () => addCustomUrl(setDialogState),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF008069),
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    ),
                                    child: const Text('Add Link', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Action Buttons Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                          decoration: const BoxDecoration(
                            color: Color(0xFFF8FAFC),
                            border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text(
                                  'Cancel',
                                  style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton.icon(
                                onPressed: () async {
                                  final rawShortcut = shortcutCtrl.text.trim();
                                  final title = titleCtrl.text.trim();
                                  final body = bodyCtrl.text.trim();
                                  final customCat = categoryCtrl.text.trim();

                                  // Only requirement: must have message text OR at least 1 media attachment
                                  if (body.isEmpty && mediaItems.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Please enter a message or attach at least one photo/video'),
                                        behavior: SnackBarBehavior.floating,
                                        backgroundColor: Color(0xFFDC2626),
                                      ),
                                    );
                                    return;
                                  }

                                  // Auto-generate shortcut if empty
                                  String shortcut = rawShortcut;
                                  if (shortcut.isEmpty || shortcut == '/') {
                                    if (title.isNotEmpty) {
                                      final clean = title.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '_');
                                      shortcut = '/$clean';
                                    } else if (mediaItems.isNotEmpty) {
                                      shortcut = '/${mediaItems.first.type}_${DateTime.now().millisecondsSinceEpoch % 1000}';
                                    } else {
                                      shortcut = '/reply_${DateTime.now().millisecondsSinceEpoch % 1000}';
                                    }
                                  } else if (!shortcut.startsWith('/')) {
                                    shortcut = '/$shortcut';
                                  }

                                  final finalTitle = title.isNotEmpty ? title : shortcut;
                                  final finalCategory = customCat.isNotEmpty ? customCat : 'General';

                                  final urls = mediaItems.map((e) => e.path).toList();
                                  final types = mediaItems.map((e) => e.type).toList();
                                  final names = mediaItems.map((e) => e.name).toList();

                                  String mType = 'text';
                                  if (mediaItems.length > 1) {
                                    mType = 'multi';
                                  } else if (mediaItems.isNotEmpty) {
                                    mType = mediaItems.first.type;
                                  }

                                  final reply = WhatsAppQuickReply(
                                    id: existing?.id ?? 'qr_${DateTime.now().millisecondsSinceEpoch}',
                                    shortcut: shortcut,
                                    title: finalTitle,
                                    body: body,
                                    category: finalCategory,
                                    mediaType: mType,
                                    mediaUrl: urls.isNotEmpty ? urls.first : null,
                                    mediaName: names.isNotEmpty ? names.first : null,
                                    mediaUrls: urls,
                                    mediaTypes: types,
                                    mediaNames: names,
                                  );

                                  final messenger = ScaffoldMessenger.of(context);
                                  Navigator.pop(ctx);

                                  if (isEditing) {
                                    await QuickRepliesStorageService.updateQuickReply(reply);
                                  } else {
                                    await QuickRepliesStorageService.addQuickReply(reply);
                                  }

                                  await _loadReplies();

                                  if (mounted) {
                                    messenger.showSnackBar(
                                      SnackBar(
                                        content: Text('Quick reply "$shortcut" saved to local device!'),
                                        backgroundColor: const Color(0xFF008069),
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                  }
                                },
                                icon: const Icon(Icons.check_rounded, size: 16),
                                label: Text(isEditing ? 'Save Changes' : 'Create Template'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF008069),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }


  void _confirmDeleteReply(WhatsAppQuickReply item) {
    showDialog(
      context: context,
      builder: (ctx) => Theme(
        data: ThemeData(
          brightness: Brightness.light,
          useMaterial3: true,
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF008069),
            surface: Colors.white,
            onSurface: Color(0xFF111B21),
          ),
          dialogTheme: const DialogTheme(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
          ),
        ),
        child: AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Delete Quick Reply?', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111B21))),
          content: Text('Remove "${item.shortcut}" (${item.title}) from your local device?', style: const TextStyle(color: Color(0xFF475569))),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(ctx);
                await QuickRepliesStorageService.deleteQuickReply(item.id.isNotEmpty ? item.id : item.shortcut);
                await _loadReplies();
                if (mounted) {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text('Removed template "${item.shortcut}"'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              child: const Text('Delete'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmClearAllReplies() {
    showDialog(
      context: context,
      builder: (ctx) => Theme(
        data: ThemeData(
          brightness: Brightness.light,
          useMaterial3: true,
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF008069),
            surface: Colors.white,
            onSurface: Color(0xFF111B21),
          ),
          dialogTheme: const DialogTheme(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
          ),
        ),
        child: AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Clear All Quick Replies?', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111B21))),
          content: const Text('This will remove all stored quick replies from your device.', style: TextStyle(color: Color(0xFF475569))),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(ctx);
                await QuickRepliesStorageService.clearAllReplies();
                await _loadReplies();
                if (mounted) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('All quick replies cleared.'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              child: const Text('Clear All'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchCtrl.text.toLowerCase().trim();
    final categories = _categories;

    final filtered = _replies.where((r) {
      final matchesQuery = query.isEmpty ||
          r.shortcut.toLowerCase().contains(query) ||
          r.title.toLowerCase().contains(query) ||
          r.body.toLowerCase().contains(query) ||
          r.category.toLowerCase().contains(query);
      final matchesCat = _selectedCategory == 'All' || r.category == _selectedCategory;
      return matchesQuery && matchesCat;
    }).toList();

    return Theme(
      data: ThemeData(
        brightness: Brightness.light,
        useMaterial3: true,
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF008069),
          surface: Colors.white,
          onSurface: Color(0xFF111B21),
        ),
        scaffoldBackgroundColor: Colors.white,
      ),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.72,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle Bar
            Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(10),
              ),
            ),

            // Header with Add Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
              child: Row(
                children: [
                  const Icon(Icons.bolt_rounded, color: Color(0xFF008069), size: 24),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Telecaller Quick Replies',
                          style: TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF111B21),
                          ),
                        ),
                        Text(
                          'Saved locally • Tap to send in chat',
                          style: TextStyle(fontSize: 11, color: Color(0xFF667781)),
                        ),
                      ],
                    ),
                  ),
                  // Add Quick Reply Action Button
                  ElevatedButton.icon(
                    onPressed: () => _showEditorDialog(),
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text('Add Reply', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF008069),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  if (_replies.isNotEmpty)
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF64748B)),
                      onSelected: (val) {
                        if (val == 'clear') {
                          _confirmClearAllReplies();
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(
                          value: 'clear',
                          child: Row(
                            children: [
                              Icon(Icons.delete_sweep_rounded, size: 18, color: Color(0xFFDC2626)),
                              SizedBox(width: 8),
                              Text('Clear All Replies', style: TextStyle(fontSize: 13, color: Color(0xFFDC2626))),
                            ],
                          ),
                        ),
                      ],
                    ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                    splashRadius: 18,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 4),

            // Search Box (if replies exist)
            if (_replies.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: TextField(
                  controller: _searchCtrl,
                  style: const TextStyle(color: Color(0xFF111B21), fontSize: 13.5),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Search templates or type /shortcut...',
                    hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() {});
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    filled: true,
                    fillColor: const Color(0xFFF1F5F9),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Dynamic Category Chips - ONLY show if user has created custom categories!
            if (categories.length > 1) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: categories.map((cat) {
                    final isSel = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: FilterChip(
                        label: Text(cat),
                        selected: isSel,
                        onSelected: (_) => setState(() => _selectedCategory = cat),
                        selectedColor: const Color(0xFFDCFCE7),
                        checkmarkColor: const Color(0xFF166534),
                        labelStyle: TextStyle(
                          color: isSel ? const Color(0xFF166534) : const Color(0xFF475569),
                          fontSize: 12,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const Divider(height: 16, color: Color(0xFFF1F5F9)),
            ] else if (_replies.isNotEmpty) ...[
              const Divider(height: 12, color: Color(0xFFF1F5F9)),
            ],

            // Templates List or Clean Empty State
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF008069)))
                  : (_replies.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32.0),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(18),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFF1F5F9),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.bolt_rounded, size: 48, color: Color(0xFF008069)),
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'No Quick Replies Yet',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111B21)),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'Create your own custom quick replies with text, images, or video demonstrations.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B), height: 1.4),
                                ),
                                const SizedBox(height: 20),
                                ElevatedButton.icon(
                                  onPressed: () => _showEditorDialog(),
                                  icon: const Icon(Icons.add_rounded, size: 18),
                                  label: const Text('Add First Quick Reply', style: TextStyle(fontWeight: FontWeight.bold)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF008069),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : (filtered.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.search_off_rounded, size: 40, color: Color(0xFFCBD5E1)),
                                  const SizedBox(height: 8),
                                  Text(
                                    'No replies matching "$query"',
                                    style: const TextStyle(fontSize: 13.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                              itemBuilder: (context, index) {
                                final item = filtered[index];
                                return InkWell(
                                  onTap: () {
                                    Navigator.pop(context);
                                    widget.onSelectReply(item);
                                  },
                                  borderRadius: BorderRadius.circular(12),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Shortcut Container
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFE0F2FE),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            item.shortcut,
                                            style: const TextStyle(
                                              color: Color(0xFF0369A1),
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),

                                        // Title, body and media tag
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      item.title,
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontSize: 14,
                                                        fontWeight: FontWeight.w700,
                                                        color: Color(0xFF111B21),
                                                      ),
                                                    ),
                                                  ),
                                                  if (item.hasMedia || item.mediaType != 'text') ...[
                                                    const SizedBox(width: 6),
                                                    _buildMediaBadge(item),
                                                  ],
                                                ],
                                              ),
                                              const SizedBox(height: 3),
                                              Text(
                                                item.body,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 12.5,
                                                  color: Color(0xFF64748B),
                                                  height: 1.3,
                                                ),
                                              ),
                                              if (item.mediaName != null && item.mediaName!.isNotEmpty) ...[
                                                const SizedBox(height: 4),
                                                Row(
                                                  children: [
                                                    const Icon(Icons.attach_file_rounded, size: 12, color: Color(0xFF008069)),
                                                    const SizedBox(width: 4),
                                                    Expanded(
                                                      child: Text(
                                                        item.mediaName!,
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                        style: const TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.w600,
                                                          color: Color(0xFF008069),
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),

                                        // Edit & Delete actions
                                        IconButton(
                                          icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF64748B)),
                                          tooltip: 'Edit Reply',
                                          splashRadius: 16,
                                          onPressed: () => _showEditorDialog(item),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                                          tooltip: 'Delete Reply',
                                          splashRadius: 16,
                                          onPressed: () => _confirmDeleteReply(item),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaBadge(WhatsAppQuickReply item) {
    Color bg;
    Color fg;
    String label;
    IconData icon;

    if (item.mediaCount > 1 || item.mediaType == 'multi') {
      bg = const Color(0xFFE0F2FE);
      fg = const Color(0xFF0369A1);
      label = 'Multi (${item.mediaCount})';
      icon = Icons.photo_library_rounded;
    } else if (item.mediaType == 'video') {
      bg = const Color(0xFFF3E8FF);
      fg = const Color(0xFF7E22CE);
      label = 'Video';
      icon = Icons.videocam_rounded;
    } else if (item.mediaType == 'image') {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF15803D);
      label = 'Image';
      icon = Icons.image_rounded;
    } else if (item.mediaType == 'document') {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFB45309);
      label = 'Doc';
      icon = Icons.description_rounded;
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: fg),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: fg),
          ),
        ],
      ),
    );
  }
}

class _QuickReplyMediaItem {
  final String path;
  final String name;
  final String type; // 'image', 'video', 'document'
  const _QuickReplyMediaItem({required this.path, required this.name, required this.type});
}
