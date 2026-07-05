import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/view_request/domain/view_request_models.dart';

/// Public (unauthenticated) view-request submission for non-members.
class ViewRequestApi {
  ViewRequestApi(this._dio);

  final Dio _dio;

  /// `POST /view-requests` — tenant identified by slug; no auth header needed.
  Future<void> submit(CreateViewRequest dto) async {
    await _dio.post<void>(Endpoints.viewRequests, data: dto.toJson());
  }
}
