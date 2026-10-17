class UserModel {
  final int id;
  final int userId;
  final String name;
  final String email;
  final String phone;
  final String employeeId;
  final String role;
  final String language;
  final List<String> permissions;
  final int? departmentId;
  final bool isManager;

  const UserModel({
    required this.id,
    required this.userId,
    required this.name,
    this.email = '',
    this.phone = '',
    this.employeeId = '',
    required this.role,
    this.language = 'EN',
    this.permissions = const [],
    this.departmentId,
    this.isManager = false,
  });

  bool get isTelecaller =>
      role.toLowerCase().contains('telecaller') ||
      role.toLowerCase().contains('sales');

  bool get isAdmin =>
      role.toLowerCase().contains('admin');

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawPerms = json['permissions'];
    List<String> perms = [];
    if (rawPerms is List) {
      perms = rawPerms.map((e) => e.toString()).toList();
    }

    final rawId = json['user_id'] ?? json['id'] ?? 0;
    final int parsedId = rawId is int ? rawId : int.tryParse(rawId.toString()) ?? 0;

    return UserModel(
      id: parsedId,
      userId: parsedId,
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      employeeId: json['employee_id']?.toString() ?? '',
      role: json['role']?.toString() ?? 'Telecaller',
      language: json['language']?.toString() ?? 'EN',
      permissions: perms,
      departmentId: json['department_id'] is int
          ? json['department_id']
          : int.tryParse(json['department_id']?.toString() ?? ''),
      isManager: json['is_manager'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'name': name,
      'email': email,
      'phone': phone,
      'employee_id': employeeId,
      'role': role,
      'language': language,
      'permissions': permissions,
      'department_id': departmentId,
      'is_manager': isManager,
    };
  }
}
