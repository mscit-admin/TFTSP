import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/notifications/domain/notification_models.dart';

class NotificationApi {
  NotificationApi(this._dio);

  final Dio _dio;

  Future<NotificationListResponse> list({int page = 1}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.notifications,
      queryParameters: {'page': page},
    );
    return NotificationListResponse.fromJson(res.data!);
  }

  Future<void> markRead(String id) async {
    await _dio.post<void>(Endpoints.notificationRead(id));
  }

  Future<void> markAllRead() async {
    await _dio.post<void>(Endpoints.notificationsReadAll);
  }
}
