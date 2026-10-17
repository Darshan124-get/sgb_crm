import 'package:flutter/material.dart';

class WhatsAppAttachmentSheet extends StatelessWidget {
  final ValueChanged<String> onOptionSelected;

  const WhatsAppAttachmentSheet({super.key, required this.onOptionSelected});

  static void show(BuildContext context, {required ValueChanged<String> onOptionSelected}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => WhatsAppAttachmentSheet(onOptionSelected: onOptionSelected),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildOption(
                  icon: Icons.insert_drive_file_rounded,
                  label: 'Document',
                  bgColor: const Color(0xFF7F66FF),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Document');
                  },
                ),
                _buildOption(
                  icon: Icons.camera_alt_rounded,
                  label: 'Camera',
                  bgColor: const Color(0xFFEC407A),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Camera');
                  },
                ),
                _buildOption(
                  icon: Icons.image_rounded,
                  label: 'Gallery',
                  bgColor: const Color(0xFFC32AA3),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Gallery');
                  },
                ),
                _buildOption(
                  icon: Icons.headset_rounded,
                  label: 'Audio Note',
                  bgColor: const Color(0xFFFF9800),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Audio');
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildOption(
                  icon: Icons.qr_code_rounded,
                  label: 'UPI Link',
                  bgColor: const Color(0xFF00A884),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Payment');
                  },
                ),
                _buildOption(
                  icon: Icons.bolt_rounded,
                  label: 'Quick Replies',
                  bgColor: const Color(0xFF008069),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('QuickReplies');
                  },
                ),
                _buildOption(
                  icon: Icons.menu_book_rounded,
                  label: 'Catalogue',
                  bgColor: const Color(0xFF0284C7),
                  onTap: () {
                    Navigator.pop(context);
                    onOptionSelected('Catalogue');
                  },
                ),
                const SizedBox(width: 54), // Spacing placeholder for balance
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOption({
    required IconData icon,
    required String label,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }
}
