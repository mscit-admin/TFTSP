import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/notifications/domain/notification_models.dart';

/// M5 device registration for FCM push.
class DeviceApi {
  DeviceApi(this._dio);

  final Dio _dio;

  /// `POST /devices` — register/refresh the caller's FCM token (upsert).
  Future<void> register(RegisterDevice dto) async {
    await _dio.post<void>(Endpoints.devices, data: dto.toJson());
  }

  /// `DELETE /devices/:token` — deregister on logout.
  Future<void> deregister(String token) async {
    await _dio.delete<void>(Endpoints.device(token));
  }
}
