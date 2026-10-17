import 'package:flutter/material.dart';
import '../../../reports/presentation/widgets/daily_telecaller_report_sheet.dart';

class MoreOptionsBottomSheet extends StatelessWidget {
  final VoidCallback? onReportsTap;

  const MoreOptionsBottomSheet({
    super.key,
    this.onReportsTap,
  });

  static void show(BuildContext context, {VoidCallback? onReportsTap}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => MoreOptionsBottomSheet(
        onReportsTap: onReportsTap,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle Bar
            Center(
              child: Container(
                width: 38,
                height: 4.5,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),

            // Header Title
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF1F5F9),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.grid_view_rounded,
                    size: 19,
                    color: Color(0xFF0A5844),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'More Options',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Telecaller utilities & advanced tools',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Telecaller Profile Card Shortcut
            InkWell(
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).pushNamed('/profile');
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0A5844), Color(0xFF064E3B)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0A5844).withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          'assets/images/user_avatar.jpg',
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(Icons.person, color: Colors.white),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Rahul Sharma',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(width: 6),
                              Icon(Icons.verified_rounded, color: Color(0xFF34D399), size: 16),
                            ],
                          ),
                          Text(
                            'SGB-TC104 • Shift Active (09:00 - 18:00)',
                            style: TextStyle(fontSize: 11.5, color: Color(0xFFD1FAE5)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 15),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 14),

            // 1. Prominent Reports & Analytics Option (Moved here as requested)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: ListTile(
                onTap: () {
                  Navigator.pop(context);
                  if (onReportsTap != null) {
                    onReportsTap!();
                  } else {
                    _showReportsPreview(context);
                  }
                },
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.bar_chart_rounded,
                    color: Color(0xFF166534),
                    size: 22,
                  ),
                ),
                title: Row(
                  children: [
                    const Flexible(
                      child: Text(
                        'Reports & Analytics',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF166534),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                subtitle: const Text(
                  'Daily calling performance, follow-up outcomes, conversion trend',
                  style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                ),
                trailing: const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 15,
                  color: Color(0xFF166534),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // 2. Targets & Calling Quota
            _buildMenuItem(
              context: context,
              icon: Icons.track_changes_rounded,
              iconColor: const Color(0xFFEA580C),
              iconBgColor: const Color(0xFFFFEDD5),
              title: 'Daily Calling Targets',
              subtitle: '42 / 50 calls completed today (84% quota achieved)',
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Target Tracker: 8 more calls needed to reach daily target'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),

            // 3. Telecaller Shift & Attendance
            _buildMenuItem(
              context: context,
              icon: Icons.access_time_filled_rounded,
              iconColor: const Color(0xFF0284C7),
              iconBgColor: const Color(0xFFE0F2FE),
              title: 'Shift & Attendance',
              subtitle: 'Logged in at 09:15 AM • Status: Active on calls',
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Shift details: Morning Shift (09:00 AM - 06:00 PM)'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),

            // 4. Dialing & Acefone Settings
            _buildMenuItem(
              context: context,
              icon: Icons.settings_rounded,
              iconColor: const Color(0xFF64748B),
              iconBgColor: const Color(0xFFF1F5F9),
              title: 'Telecaller Settings',
              subtitle: 'Acefone extension, call audio recording, audio speed',
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Telecaller settings opened'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),

            // 5. Help & FAQ
            _buildMenuItem(
              context: context,
              icon: Icons.help_outline_rounded,
              iconColor: const Color(0xFF8B5CF6),
              iconBgColor: const Color(0xFFF3E8FF),
              title: 'Help & Calling Scripts',
              subtitle: 'Standard pitch scripts for Organic Fertilizer & Neem Oil',
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Calling scripts & FAQ handbook opened'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),

            _buildMenuItem(
              context: context,
              icon: Icons.shield_outlined,
              iconColor: const Color(0xFF059669),
              iconBgColor: const Color(0xFFECFDF5),
              title: 'Privacy Policy & Terms',
              subtitle: 'Data safety, permissions & enterprise terms',
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).pushNamed('/privacy-policy');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconBgColor,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
        subtitle: Text(
          subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          size: 20,
          color: Color(0xFF94A3B8),
        ),
      ),
    );
  }

  void _showReportsPreview(BuildContext context) {
    DailyTelecallerReportSheet.show(context);
  }
}
