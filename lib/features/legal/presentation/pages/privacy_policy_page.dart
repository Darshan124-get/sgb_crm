import 'package:flutter/material.dart';

class PrivacyPolicyPage extends StatefulWidget {
  final int initialTabIndex;

  const PrivacyPolicyPage({
    super.key,
    this.initialTabIndex = 0,
  });

  @override
  State<PrivacyPolicyPage> createState() => _PrivacyPolicyPageState();
}

class _PrivacyPolicyPageState extends State<PrivacyPolicyPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const Color primaryGreen = Color(0xFF0A5844);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: primaryGreen,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Legal & Data Safety',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF4ADE80),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFFD1FAE5),
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(text: 'Privacy Policy'),
            Tab(text: 'Terms of Use'),
            Tab(text: 'Permissions'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPrivacyTab(),
          _buildTermsTab(),
          _buildPermissionsTab(),
        ],
      ),
    );
  }

  Widget _buildPrivacyTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeaderCard(
            title: 'Privacy Policy',
            subtitle: 'SGB Connect Enterprise Telecaller Suite\nEffective: October 2026',
            badge: 'DPDP Act 2023 & Google Play Compliant',
          ),
          const SizedBox(height: 18),
          _buildSectionTitle('1. Overview & Commitment'),
          _buildParagraph(
            'SGB Agro Industries ("Company", "we") is committed to protecting the privacy of our telecalling agents and farmer clients. This policy outlines how information is gathered, processed, and safeguarded when operating the SGB Connect application.',
          ),
          _buildSectionTitle('2. Information Gathered'),
          _buildBulletItem('Staff Profile: Name, registered business mobile number, role, and PBX telephony extension.'),
          _buildBulletItem('Customer Lead Info: Farmer name, phone, district/state, crop inquiry, and CRM stage.'),
          _buildBulletItem('Voice Messages: Microphone recordings captured strictly for outgoing WhatsApp voice notes.'),
          _buildBulletItem('Media Uploads: Photos of payment receipts (UPI/NEFT) and equipment damage inspection.'),
          _buildBulletItem('Telephony Logs: Call timestamps, duration, and connection status via Acefone PBX API.'),
          _buildSectionTitle('3. Zero Data Monetization'),
          _buildParagraph(
            'We strictly DO NOT sell, rent, license, or disclose user or customer data to third-party advertising networks, data brokers, or marketing affiliates.',
          ),
          _buildSectionTitle('4. Encryption & Security Standards'),
          _buildParagraph(
            'All data transmissions are protected via Transport Layer Security (TLS 1.3 / HTTPS). Database storage employs encrypted data-at-rest protocols, with strict role-based access control preventing unauthorized lead visibility.',
          ),
          _buildSectionTitle('5. Rights & Account Deletion'),
          _buildParagraph(
            'Agents and customers have the right to request access, correction, or deletion of their personal records. Contact our Data Protection Officer at privacy@sgbagro.com.',
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildTermsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeaderCard(
            title: 'Terms and Conditions',
            subtitle: 'Rules of Telecalling & CRM Usage\nAuthorized SGB Personnel Only',
            badge: 'Binding Enterprise Agreement',
          ),
          const SizedBox(height: 18),
          _buildSectionTitle('1. Authorized Access'),
          _buildParagraph(
            'SGB Connect is restricted to verified employees, contractors, and sales representatives of SGB Agro Industries. Account sharing or unauthorized data export is strictly prohibited.',
          ),
          _buildSectionTitle('2. Code of Telecaller Conduct'),
          _buildBulletItem('Maintain professional courtesy when communicating with farmers and agricultural dealers.'),
          _buildBulletItem('Adhere to national TRAI calling hours (9:00 AM to 8:00 PM local time).'),
          _buildBulletItem('Voice notes and attachments must strictly relate to company products, orders, and farmer service.'),
          _buildBulletItem('Uploading fraudulent payment receipts constitutes immediate grounds for account revocation.'),
          _buildSectionTitle('3. Cloud Telephony Services'),
          _buildParagraph(
            'Cloud telephony is powered by integrated PBX providers (Acefone). Call connection is subject to network carrier availability. Call duration and connection logs are monitored for performance quality assurance.',
          ),
          _buildSectionTitle('4. Intellectual Property'),
          _buildParagraph(
            'All software code, graphic designs, product brochures, logos, and agricultural machinery designs remain the exclusive property of SGB Agro Industries.',
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildPermissionsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeaderCard(
            title: 'Device Permissions & Data Safety',
            subtitle: 'Transparent breakdown of Android permissions\nrequested by SGB Connect',
            badge: 'Google Play Data Safety Section',
          ),
          const SizedBox(height: 18),

          _buildPermissionTile(
            icon: Icons.mic_rounded,
            color: const Color(0xFF0A5844),
            bgColor: const Color(0xFFE6F4EA),
            permissionName: 'Microphone (RECORD_AUDIO)',
            purpose: 'Required to record and send WhatsApp voice notes to customer leads directly within the chat screen. The microphone is active only while pressing the record button.',
            playStoreCategory: 'Audio Files • Voice Recordings',
          ),

          _buildPermissionTile(
            icon: Icons.camera_alt_rounded,
            color: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
            permissionName: 'Camera (CAMERA)',
            purpose: 'Used to take photos of customer payment receipts, UPI transaction proofs, product deliveries, or profile pictures directly inside the app.',
            playStoreCategory: 'Photos and Videos',
          ),

          _buildPermissionTile(
            icon: Icons.photo_library_rounded,
            color: const Color(0xFFD97706),
            bgColor: const Color(0xFFFEF3C7),
            permissionName: 'Storage & Media (READ_MEDIA_*)',
            purpose: 'Allows selecting product catalogue PDFs and payment screenshots from device gallery to attach in WhatsApp chat, and saving voice notes temporarily.',
            playStoreCategory: 'Files and Docs • Photos',
          ),

          _buildPermissionTile(
            icon: Icons.phone_in_talk_rounded,
            color: const Color(0xFF059669),
            bgColor: const Color(0xFFECFDF5),
            permissionName: 'Telephony & Network (Acefone PBX)',
            purpose: 'Click-to-call initiates cloud calls via Acefone PBX API so agents can talk with leads without exposing personal SIM cards. Standard calls fallback to device dialer.',
            playStoreCategory: 'App Activity • Contact Logs',
          ),

          _buildPermissionTile(
            icon: Icons.wifi_rounded,
            color: const Color(0xFF7C3AED),
            bgColor: const Color(0xFFF5F3FF),
            permissionName: 'Internet & Connection (INTERNET)',
            purpose: 'Required to securely communicate with SGB Agro backend servers for lead synchronization, WhatsApp messaging, and order booking.',
            playStoreCategory: 'Network Connection',
          ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildHeaderCard({
    required String title,
    required String subtitle,
    required String badge,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              badge,
              style: const TextStyle(
                color: Color(0xFF166534),
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0F172A),
        ),
      ),
    );
  }

  Widget _buildParagraph(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 13.5,
          color: Color(0xFF475569),
          height: 1.5,
        ),
      ),
    );
  }

  Widget _buildBulletItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(color: primaryGreen, fontSize: 16, fontWeight: FontWeight.bold)),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF475569),
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionTile({
    required IconData icon,
    required Color color,
    required Color bgColor,
    required String permissionName,
    required String purpose,
    required String playStoreCategory,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      permissionName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      'Play Store: $playStoreCategory',
                      style: TextStyle(
                        fontSize: 11,
                        color: color,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            purpose,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF475569),
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
