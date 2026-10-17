import 'package:flutter/material.dart';
import '../../domain/models/lead_detail_model.dart';

class LeadDetailHeader extends StatelessWidget {
  final LeadDetailModel detail;
  final VoidCallback? onBack;
  final VoidCallback? onCall;
  final VoidCallback? onWhatsApp;
  final VoidCallback? onNote;
  final VoidCallback? onFollowUp;
  final VoidCallback? onMore;
  final VoidCallback? onOptionsMenu;
  final VoidCallback? onConvert;

  const LeadDetailHeader({
    super.key,
    required this.detail,
    this.onBack,
    this.onCall,
    this.onWhatsApp,
    this.onNote,
    this.onFollowUp,
    this.onMore,
    this.onOptionsMenu,
    this.onConvert,
  });

  @override
  Widget build(BuildContext context) {
    final lead = detail.lead;

    return Container(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // 1. App Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: onBack ?? () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 20,
                      color: Color(0xFF0F172A),
                    ),
                    splashRadius: 22,
                  ),
                  const Text(
                    'Lead Details',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: onOptionsMenu,
                    icon: const Icon(
                      Icons.more_vert_rounded,
                      size: 22,
                      color: Color(0xFF334155),
                    ),
                    splashRadius: 22,
                  ),
                ],
              ),
            ),

            // 2. Lead Profile Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar Initials Circle
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: lead.avatarBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        lead.initials,
                        style: TextStyle(
                          color: lead.avatarTextColor,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(width: 14),

                  // Lead Details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Name & Status Row
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                lead.name,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3.5,
                              ),
                              decoration: BoxDecoration(
                                color: lead.statusBgColor,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                lead.statusLabel,
                                style: TextStyle(
                                  color: lead.statusTextColor,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 5),

                        // Phone with WhatsApp icon
                        Row(
                          children: [
                            Text(
                              lead.phone,
                              style: const TextStyle(
                                color: Color(0xFF475569),
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: onWhatsApp,
                              child: Container(
                                padding: const EdgeInsets.all(2.5),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF25D366),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.chat_bubble_rounded,
                                  size: 11,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 4),

                        // Location Pin
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on_rounded,
                              size: 14,
                              color: Color(0xFF64748B),
                            ),
                            const SizedBox(width: 3),
                            Text(
                              lead.location,
                              style: const TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 5),

                        // Source: Facebook Ad
                        Row(
                          children: [
                            Container(
                              width: 15,
                              height: 15,
                              decoration: const BoxDecoration(
                                color: Color(0xFF1877F2),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Text(
                                  'f',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                detail.source,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Color(0xFF475569),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 6),

                        // Product Badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3.5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFFDCFCE7),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.eco_rounded,
                                size: 13,
                                color: Color(0xFF16A34A),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                detail.productInterest,
                                style: const TextStyle(
                                  color: Color(0xFF15803D),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // 3. Quick Action Buttons Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _QuickActionButton(
                    icon: Icons.phone_in_talk_rounded,
                    label: 'Call',
                    bgColor: const Color(0xFF0A5844),
                    iconColor: Colors.white,
                    onTap: onCall,
                  ),
                  _QuickActionButton(
                    icon: Icons.chat_bubble_rounded,
                    label: 'WhatsApp',
                    bgColor: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    onTap: onWhatsApp,
                  ),
                  _QuickActionButton(
                    icon: Icons.shopping_cart_checkout_rounded,
                    label: 'Convert',
                    bgColor: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF059669),
                    onTap: onConvert ?? onNote,
                  ),
                  _QuickActionButton(
                    icon: Icons.calendar_month_rounded,
                    label: 'Follow-up',
                    bgColor: const Color(0xFFFFEDD5),
                    iconColor: const Color(0xFFEA580C),
                    onTap: onFollowUp,
                  ),
                  _QuickActionButton(
                    icon: Icons.more_horiz_rounded,
                    label: 'More',
                    bgColor: const Color(0xFFF1F5F9),
                    iconColor: const Color(0xFF64748B),
                    onTap: onMore,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final Color bgColor;
  final Color iconColor;
  final VoidCallback? onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.bgColor,
    required this.iconColor,
    this.onTap,
  });

  @override
  State<_QuickActionButton> createState() => _QuickActionButtonState();
}

class _QuickActionButtonState extends State<_QuickActionButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedScale(
            scale: _isPressed ? 0.92 : 1.0,
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeInOut,
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: widget.bgColor,
                shape: BoxShape.circle,
                boxShadow: widget.bgColor == const Color(0xFF0A5844)
                    ? [
                        BoxShadow(
                          color: const Color(0xFF0A5844).withValues(alpha: 0.28),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: Icon(
                  widget.icon,
                  color: widget.iconColor,
                  size: 21,
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }
}
