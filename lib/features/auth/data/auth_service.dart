import '../../../core/network/api_client.dart';
import '../../../core/storage/session_storage.dart';
import '../domain/models/user_model.dart';

class AuthResult {
  final bool isSuccess;
  final UserModel? user;
  final String? token;
  final String? errorMessage;

  const AuthResult({
    required this.isSuccess,
    this.user,
    this.token,
    this.errorMessage,
  });

  factory AuthResult.success({required UserModel user, required String token}) {
    return AuthResult(
      isSuccess: true,
      user: user,
      token: token,
    );
  }

  factory AuthResult.failure(String message) {
    return AuthResult(
      isSuccess: false,
      errorMessage: message,
    );
  }
}

class AuthService {
  static Future<AuthResult> login({
    required String identifier,
    required String password,
  }) async {
    final response = await ApiClient.post(
      '/auth/login',
      body: {
        'identifier': identifier.trim(),
        'password': password,
      },
    );

    if (response.isSuccess && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      final token = data['token']?.toString() ?? '';
      final rawUser = data['user'];

      if (token.isEmpty || rawUser == null || rawUser is! Map<String, dynamic>) {
        return AuthResult.failure('Invalid server response format');
      }

      final user = UserModel.fromJson(rawUser);

      // Persist session locally
      await SessionStorage.saveSession(token: token, user: user);

      return AuthResult.success(user: user, token: token);
    } else {
      return AuthResult.failure(
        response.errorMessage ?? 'Login failed. Please check credentials.',
      );
    }
  }

  static Future<void> logout() async {
    await SessionStorage.clearSession();
  }

  static bool get isAuthenticated => SessionStorage.isLoggedIn;
  static UserModel? get currentUser => SessionStorage.currentUser;
}
