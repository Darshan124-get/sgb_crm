import '../../../auth/domain/models/user_model.dart';

class UserProfile {
  final String name;
  final String designation;
  final String empId;
  final String phone;
  final String email;
  final String department;
  final String acefoneExtension;
  final bool isAcefoneConnected;
  final String shift;
  final bool isShiftActive;
  final String loginTime;
  final List<String> languages;
  final String location;
  final int callsToday;
  final int targetCalls;
  final int talkTimeMinutes;
  final int convertedLeads;
  final double monthlyConversionRate;
  final double rating;
  final bool isCallRecordingEnabled;
  final String autoDialerMode;
  final bool whatsappNotifications;
  final bool biometricLock;

  const UserProfile({
    required this.name,
    required this.designation,
    required this.empId,
    required this.phone,
    required this.email,
    required this.department,
    required this.acefoneExtension,
    this.isAcefoneConnected = true,
    required this.shift,
    this.isShiftActive = true,
    required this.loginTime,
    required this.languages,
    required this.location,
    required this.callsToday,
    required this.targetCalls,
    required this.talkTimeMinutes,
    required this.convertedLeads,
    required this.monthlyConversionRate,
    required this.rating,
    this.isCallRecordingEnabled = true,
    this.autoDialerMode = 'Standard',
    this.whatsappNotifications = true,
    this.biometricLock = false,
  });

  double get dailyTargetProgress => targetCalls > 0 ? (callsToday / targetCalls).clamp(0.0, 1.0) : 0.0;

  String get talkTimeFormatted {
    final hours = talkTimeMinutes ~/ 60;
    final mins = talkTimeMinutes % 60;
    if (hours > 0) {
      return '${hours}h ${mins}m';
    }
    return '${mins}m';
  }

  UserProfile copyWith({
    String? name,
    String? designation,
    String? empId,
    String? phone,
    String? email,
    String? department,
    String? acefoneExtension,
    bool? isAcefoneConnected,
    String? shift,
    bool? isShiftActive,
    String? loginTime,
    List<String>? languages,
    String? location,
    int? callsToday,
    int? targetCalls,
    int? talkTimeMinutes,
    int? convertedLeads,
    double? monthlyConversionRate,
    double? rating,
    bool? isCallRecordingEnabled,
    String? autoDialerMode,
    bool? whatsappNotifications,
    bool? biometricLock,
  }) {
    return UserProfile(
      name: name ?? this.name,
      designation: designation ?? this.designation,
      empId: empId ?? this.empId,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      department: department ?? this.department,
      acefoneExtension: acefoneExtension ?? this.acefoneExtension,
      isAcefoneConnected: isAcefoneConnected ?? this.isAcefoneConnected,
      shift: shift ?? this.shift,
      isShiftActive: isShiftActive ?? this.isShiftActive,
      loginTime: loginTime ?? this.loginTime,
      languages: languages ?? this.languages,
      location: location ?? this.location,
      callsToday: callsToday ?? this.callsToday,
      targetCalls: targetCalls ?? this.targetCalls,
      talkTimeMinutes: talkTimeMinutes ?? this.talkTimeMinutes,
      convertedLeads: convertedLeads ?? this.convertedLeads,
      monthlyConversionRate: monthlyConversionRate ?? this.monthlyConversionRate,
      rating: rating ?? this.rating,
      isCallRecordingEnabled: isCallRecordingEnabled ?? this.isCallRecordingEnabled,
      autoDialerMode: autoDialerMode ?? this.autoDialerMode,
      whatsappNotifications: whatsappNotifications ?? this.whatsappNotifications,
      biometricLock: biometricLock ?? this.biometricLock,
    );
  }

  factory UserProfile.fromSession({
    UserModel? user,
    Map<String, dynamic>? stats,
  }) {
    final name = (user != null && user.name.isNotEmpty) ? user.name : 'Telecaller Executive';
    final role = (user != null && user.role.isNotEmpty) ? user.role.replaceAll('_', ' ').toUpperCase() : 'TELECALLER';
    final phone = (user != null && user.phone.isNotEmpty) ? user.phone : '+91 63645 94854';
    final email = (user != null && user.email.isNotEmpty)
        ? user.email
        : '${name.toLowerCase().replaceAll(' ', '.')}@sgbagro.in';
    final id = (user != null) ? user.id.toString() : '107';

    return UserProfile(
      name: name,
      designation: '$role • Farmer Advisory',
      empId: 'SGB-TC$id',
      phone: phone,
      email: email,
      department: 'Farmer Advisory & Outbound Sales',
      acefoneExtension: 'Ext #$id (Connected)',
      isAcefoneConnected: true,
      shift: 'General Shift (09:00 AM - 06:00 PM)',
      isShiftActive: true,
      loginTime: '09:00 AM',
      languages: const ['Hindi', 'Kannada', 'English'],
      location: 'SGB Central Operations, India',
      callsToday: 38,
      targetCalls: 50,
      talkTimeMinutes: 142,
      convertedLeads: 6,
      monthlyConversionRate: 15.8,
      rating: 4.8,
      isCallRecordingEnabled: true,
      autoDialerMode: 'Standard (30s interval)',
      whatsappNotifications: true,
      biometricLock: false,
    );
  }

  static UserProfile defaultProfile() {
    return const UserProfile(
      name: 'Rahul Sharma',
      designation: 'Senior Telecaller & Agro Advisory Executive',
      empId: 'SGB-TC104',
      phone: '+91 98765 43210',
      email: 'rahul.sharma@sgbagro.com',
      department: 'Farmer Advisory & Outbound Sales',
      acefoneExtension: 'Ext #104 (Connected)',
      isAcefoneConnected: true,
      shift: 'Morning Shift (09:00 AM - 06:00 PM)',
      isShiftActive: true,
      loginTime: '09:12 AM',
      languages: ['Hindi', 'Rajasthani', 'English'],
      location: 'Jaipur Main Office, Rajasthan',
      callsToday: 42,
      targetCalls: 50,
      talkTimeMinutes: 184,
      convertedLeads: 8,
      monthlyConversionRate: 16.8,
      rating: 4.9,
      isCallRecordingEnabled: true,
      autoDialerMode: 'Standard (30s interval)',
      whatsappNotifications: true,
      biometricLock: false,
    );
  }
}
