import 'package:flutter/material.dart';

class OnboardingItem {
  final String badge;
  final String title;
  final String description;
  final String imageAsset;
  final List<String> features;
  final IconData badgeIcon;

  const OnboardingItem({
    required this.badge,
    required this.title,
    required this.description,
    required this.imageAsset,
    required this.features,
    required this.badgeIcon,
  });
}

class OnboardingConstants {
  OnboardingConstants._();

  // Colors
  static const Color brandBlue = Color(0xFF005AFF);
  static const Color brandRed = Color(0xFFE50914);
  static const Color backgroundLight = Color(0xFFFFFFFF);
  static const Color surfaceLight = Color(0xFFF8FAFC);
  static const Color cardBorder = Color(0xFFE2E8F0);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color badgeBg = Color(0x14005AFF);
  static const Color badgeText = Color(0xFF005AFF);

  // Asset paths
  static const String callingIllustration = 'assets/illustrations/onboard_calling.jpg';
  static const String crmIllustration = 'assets/illustrations/onboard_crm.jpg';
  static const String growthIllustration = 'assets/illustrations/onboard_growth.jpg';

  // 3 Onboarding Items tailored for the Telecaller Mobile CRM
  static const List<OnboardingItem> items = [
    OnboardingItem(
      badge: 'SMART TELECALLING',
      badgeIcon: Icons.phone_in_talk_rounded,
      title: 'One-Tap Calling &\nInstant Mobile Dialing',
      description:
          'Empower your telecalling workflow directly on your phone. Connect instantly with Acefone integration, auto-log call durations, and record customer conversations seamlessly.',
      imageAsset: callingIllustration,
      features: [
        '1-Tap Click-to-Call Dialer',
        'Auto Call Logging & Recordings',
        'Instant Call Dispositions',
      ],
    ),
    OnboardingItem(
      badge: 'OMNICHANNEL CRM',
      badgeIcon: Icons.hub_rounded,
      title: 'Lead Management &\nInstant WhatsApp Chats',
      description:
          'Access all assigned leads anywhere without needing a desktop. Send customized WhatsApp messages in one click, update lead stages, and never miss a scheduled callback.',
      imageAsset: crmIllustration,
      features: [
        'Real-time Assigned Leads',
        'Direct WhatsApp Messaging',
        'Follow-up Alerts & Reminders',
      ],
    ),
    OnboardingItem(
      badge: 'GROWTH & CONVERSIONS',
      badgeIcon: Icons.trending_up_rounded,
      title: 'Convert Leads into\nConfirmed Sales Orders',
      description:
          'Turn interactions into business revenue. Generate quotations, book verified orders on the spot, and track your daily call targets and incentives with live analytics.',
      imageAsset: growthIllustration,
      features: [
        'Fast Mobile Order Booking',
        'Live Target & Incentive Tracker',
        'Daily Performance Analytics',
      ],
    ),
  ];
}
