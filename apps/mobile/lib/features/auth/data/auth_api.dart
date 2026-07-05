import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/auth/domain/auth_models.dart';

/// Plain-dio auth service (no retrofit/codegen).
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<LoginResponse> login({
    required String email,
    required String password,
    String? tenantSlug,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.login,
      data: {
        'email': email,
        'password': password,
        if (tenantSlug != null && tenantSlug.isNotEmpty)
          'tenantSlug': tenantSlug,
      },
    );
    return LoginResponse.fromJson(res.data!);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post<void>(
      Endpoints.logout,
      data: {'refreshToken': refreshToken},
    );
  }
}
