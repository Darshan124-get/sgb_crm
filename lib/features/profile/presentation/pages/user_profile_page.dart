import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/storage/session_storage.dart';
import '../../../auth/data/auth_service.dart';
import '../../../auth/presentation/pages/login_page.dart';
import '../../domain/models/user_profile_model.dart';

class UserProfilePage extends StatefulWidget {
  final UserProfile? initialProfile;

  const UserProfilePage({
    super.key,
    this.initialProfile,
  });

  @override
  State<UserProfilePage> createState() => _UserProfilePageState();
}

class _UserProfilePageState extends State<UserProfilePage> {
  late UserProfile _profile;

  @override
  void initState() {
    super.initState();
    _profile = widget.initialProfile ??
        (SessionStorage.currentUser != null
            ? UserProfile.fromSession(user: SessionStorage.currentUser)
            : UserProfile.defaultProfile());
  }

  void _showEditProfileSheet() {
    final nameCtrl = TextEditingController(text: _profile.name);
    final phoneCtrl = TextEditingController(text: _profile.phone);
    final emailCtrl = TextEditingController(text: _profile.email);
    final designationCtrl = TextEditingController(text: _profile.designation);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const Row(
                children: [
                  Icon(Icons.edit_rounded, color: Color(0xFF0A5844), size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Edit Telecaller Profile',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Full Name',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: designationCtrl,
                decoration: InputDecoration(
                  labelText: 'Designation & Role',
                  prefixIcon: const Icon(Icons.badge_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Contact Number',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Official Email',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) return;

                    setState(() {
                      _profile = _profile.copyWith(
                        name: name,
                        designation: designationCtrl.text.trim(),
                        phone: phoneCtrl.text.trim(),
                        email: emailCtrl.text.trim(),
                      );
                    });

                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Profile details updated successfully!'),
                        backgroundColor: Color(0xFF16A34A),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0A5844),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Save Changes',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEndShiftDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.access_time_filled_rounded, color: Color(0xFFEA580C)),
            SizedBox(width: 8),
            Expanded(child: Text('End Daily Shift?')),
          ],
        ),
        content: const Text(
          'Are you sure you want to clock out for today? Your 42 calls will be submitted to the CRM admin report.',
          style: TextStyle(color: Color(0xFF475569), fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _profile = _profile.copyWith(isShiftActive: false);
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Shift completed. Daily summary sent to supervisor.'),
                  backgroundColor: Color(0xFF0A5844),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEA580C),
              foregroundColor: Colors.white,
            ),
            child: const Text('Clock Out'),
          ),
        ],
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            SizedBox(width: 8),
            Expanded(child: Text('Confirm Logout')),
          ],
        ),
        content: const Text(
          'You will be signed out of SGB Connect on this mobile device. Telecalling sessions will pause.',
          style: TextStyle(color: Color(0xFF475569), fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await AuthService.logout();
              if (!mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginPage()),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A5844),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'My Profile',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: Colors.white),
            tooltip: 'Edit Profile',
            onPressed: _showEditProfileSheet,
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 36),
        child: Column(
          children: [
            // 1. Hero Profile Header Card
            _buildProfileHeroCard(),

            const SizedBox(height: 16),

            // 2. Telecaller Daily KPI Performance Grid
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildPerformanceCard(),
            ),

            const SizedBox(height: 16),

            // 3. Official Telecaller Details Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildOfficialDetailsCard(),
            ),

            const SizedBox(height: 16),

            // 4. Telephony & Acefone Integration Settings
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildTelephonySettingsCard(),
            ),

            const SizedBox(height: 16),

            // 5. App & Security Preferences
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildSecuritySettingsCard(),
            ),

            const SizedBox(height: 24),

            // 6. Logout & Version Footer
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _confirmLogout,
                      icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
                      label: const Text(
                        'Log Out from SGB Connect',
                        style: TextStyle(
                          color: Color(0xFFDC2626),
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        backgroundColor: const Color(0xFFFEF2F2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'SGB Connect v1.0.4 • Build 42\nPowered by SGB Agro Telecaller Engine',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeroCard() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0A5844), Color(0xFF064736)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Color(0x220A5844),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      child: Column(
        children: [
          // Avatar + Edit badge
          Stack(
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Image.asset(
                    'assets/images/user_avatar.jpg',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: const Color(0xFF10B981),
                      child: Center(
                        child: Text(
                          _profile.name.isNotEmpty ? _profile.name[0] : 'R',
                          style: const TextStyle(
                            fontSize: 34,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: 2,
                right: 2,
                child: GestureDetector(
                  onTap: _showEditProfileSheet,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 14),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Name
          Text(
            _profile.name,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.2,
            ),
          ),

          const SizedBox(height: 4),

          // Designation
          Text(
            _profile.designation,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFFD1FAE5),
            ),
          ),

          const SizedBox(height: 12),

          // Employee ID & Shift Status Badges
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.badge_rounded, color: Color(0xFFBBF7D0), size: 14),
                    const SizedBox(width: 5),
                    Text(
                      _profile.empId,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _profile.isShiftActive
                      ? const Color(0xFF10B981).withValues(alpha: 0.25)
                      : Colors.red.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _profile.isShiftActive ? const Color(0xFF10B981) : Colors.red,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: _profile.isShiftActive ? const Color(0xFF34D399) : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _profile.isShiftActive ? 'Shift Active' : 'Shift Ended',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.military_tech_rounded, color: Color(0xFFEAB308), size: 22),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  "Today's Calling Target",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Top Performer 🏆',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFB45309),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Progress Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_profile.callsToday} of ${_profile.targetCalls} calls completed',
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
              ),
              Text(
                '${(_profile.dailyTargetProgress * 100).toInt()}%',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0A5844)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: _profile.dailyTargetProgress,
              minHeight: 8,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF10B981)),
            ),
          ),

          const SizedBox(height: 16),

          // 4 Mini KPIs
          Row(
            children: [
              _buildMiniKpi(
                title: 'Calls Made',
                value: '${_profile.callsToday}',
                icon: Icons.phone_callback_rounded,
                iconColor: const Color(0xFF2563EB),
                bgColor: const Color(0xFFEFF6FF),
              ),
              const SizedBox(width: 10),
              _buildMiniKpi(
                title: 'Talk Time',
                value: _profile.talkTimeFormatted,
                icon: Icons.timer_rounded,
                iconColor: const Color(0xFF059669),
                bgColor: const Color(0xFFECFDF5),
              ),
              const SizedBox(width: 10),
              _buildMiniKpi(
                title: 'Converted',
                value: '${_profile.convertedLeads}',
                icon: Icons.check_circle_rounded,
                iconColor: const Color(0xFF7C3AED),
                bgColor: const Color(0xFFF5F3FF),
              ),
              const SizedBox(width: 10),
              _buildMiniKpi(
                title: 'Rating',
                value: '${_profile.rating} ★',
                icon: Icons.star_rounded,
                iconColor: const Color(0xFFD97706),
                bgColor: const Color(0xFFFFFBEB),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniKpi({
    required String title,
    required String value,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: iconColor, size: 18),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: iconColor,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 10,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfficialDetailsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Official Contact & Shift Details',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 12),

          _buildDetailRow(
            icon: Icons.phone_rounded,
            label: 'Phone Number',
            value: _profile.phone,
            onCopy: () {
              Clipboard.setData(ClipboardData(text: _profile.phone));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Phone copied to clipboard'), behavior: SnackBarBehavior.floating),
              );
            },
          ),
          const Divider(height: 18, color: Color(0xFFF1F5F9)),

          _buildDetailRow(
            icon: Icons.email_rounded,
            label: 'Official Email',
            value: _profile.email,
            onCopy: () {
              Clipboard.setData(ClipboardData(text: _profile.email));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Email copied to clipboard'), behavior: SnackBarBehavior.floating),
              );
            },
          ),
          const Divider(height: 18, color: Color(0xFFF1F5F9)),

          _buildDetailRow(
            icon: Icons.business_rounded,
            label: 'Department',
            value: _profile.department,
          ),
          const Divider(height: 18, color: Color(0xFFF1F5F9)),

          _buildDetailRow(
            icon: Icons.location_on_rounded,
            label: 'Branch Location',
            value: _profile.location,
          ),
          const Divider(height: 18, color: Color(0xFFF1F5F9)),

          _buildDetailRow(
            icon: Icons.access_time_filled_rounded,
            label: 'Shift Timing',
            value: _profile.shift,
          ),
          const Divider(height: 18, color: Color(0xFFF1F5F9)),

          // Languages Spoken
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.translate_rounded, size: 16, color: Color(0xFF475569)),
              ),
              const SizedBox(width: 10),
              const Text(
                'Languages',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
              const Spacer(),
              Flexible(
                child: Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  alignment: WrapAlignment.end,
                  children: _profile.languages
                      .map(
                        (lang) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Text(
                            lang,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF166534),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
    VoidCallback? onCopy,
  }) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(
            color: Color(0xFFF1F5F9),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: const Color(0xFF475569)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
            ],
          ),
        ),
        if (onCopy != null) ...[
          const SizedBox(width: 6),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 16, color: Color(0xFF94A3B8)),
            tooltip: 'Copy',
            onPressed: onCopy,
          ),
        ],
      ],
    );
  }

  Widget _buildTelephonySettingsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.headset_mic_rounded, color: Color(0xFF0A5844), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Telephony & Acefone Integration',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Acefone Extension Status
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFE0F2FE),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.phone_in_talk_rounded, color: Color(0xFF0284C7), size: 19),
            ),
            title: const Text(
              'Acefone Cloud Extension',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: Text(
              _profile.isAcefoneConnected ? 'Ext #104 • Connected & Ready' : 'Extension Disconnected',
              style: TextStyle(
                fontSize: 12,
                color: _profile.isAcefoneConnected ? const Color(0xFF0284C7) : const Color(0xFFEF4444),
                fontWeight: FontWeight.w600,
              ),
            ),
            trailing: Switch(
              value: _profile.isAcefoneConnected,
              activeColor: const Color(0xFF0A5844),
              onChanged: (val) {
                setState(() {
                  _profile = _profile.copyWith(isAcefoneConnected: val);
                });
              },
            ),
          ),

          const Divider(height: 12, color: Color(0xFFF1F5F9)),

          // Auto Call Audio Recording
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.mic_rounded, color: Color(0xFF166534), size: 19),
            ),
            title: const Text(
              'Auto Call Recording',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: const Text(
              'Record farmer calls for compliance & training',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            trailing: Switch(
              value: _profile.isCallRecordingEnabled,
              activeColor: const Color(0xFF0A5844),
              onChanged: (val) {
                setState(() {
                  _profile = _profile.copyWith(isCallRecordingEnabled: val);
                });
              },
            ),
          ),

          const Divider(height: 12, color: Color(0xFFF1F5F9)),

          // WhatsApp Cloud Notifications
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chat_bubble_rounded, color: Color(0xFF25D366), size: 19),
            ),
            title: const Text(
              'WhatsApp Handoff Alerts',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: const Text(
              'Notify when farmer asks for human agent',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            trailing: Switch(
              value: _profile.whatsappNotifications,
              activeColor: const Color(0xFF0A5844),
              onChanged: (val) {
                setState(() {
                  _profile = _profile.copyWith(whatsappNotifications: val);
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecuritySettingsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.security_rounded, color: Color(0xFF0A5844), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Security & Attendance',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Clock Out Shift Button
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFFFEDD5),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.timer_off_rounded, color: Color(0xFFEA580C), size: 19),
            ),
            title: const Text(
              'Clock Out & End Shift',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: Text(
              _profile.isShiftActive ? 'Shift active since ${_profile.loginTime}' : 'Shift currently ended',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            trailing: ElevatedButton(
              onPressed: _profile.isShiftActive ? _showEndShiftDialog : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('End Shift', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),

          const Divider(height: 12, color: Color(0xFFF1F5F9)),

          // Biometric Lock
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.fingerprint_rounded, color: Color(0xFF475569), size: 19),
            ),
            title: const Text(
              'Biometric App Lock',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: const Text(
              'Require fingerprint to open SGB Connect',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            trailing: Switch(
              value: _profile.biometricLock,
              activeColor: const Color(0xFF0A5844),
              onChanged: (val) {
                setState(() {
                  _profile = _profile.copyWith(biometricLock: val);
                });
              },
            ),
          ),

          const Divider(height: 12, color: Color(0xFFF1F5F9)),

          // Privacy Policy & Data Safety
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFECFDF5),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shield_outlined, color: Color(0xFF059669), size: 19),
            ),
            title: const Text(
              'Privacy Policy & Terms',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: const Text(
              'DPDP Act 2023, permissions & legal policies',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFF94A3B8)),
            onTap: () {
              Navigator.of(context).pushNamed('/privacy-policy');
            },
          ),
        ],
      ),
    );
  }
}
