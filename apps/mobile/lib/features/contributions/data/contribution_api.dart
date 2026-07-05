import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/contributions/domain/contribution_models.dart';

class ContributionApi {
  ContributionApi(this._dio);

  final Dio _dio;

  /// `GET /change-requests?mine=true` — my requests.
  Future<List<ChangeRequest>> myRequests() async {
    final res = await _dio.get<dynamic>(
      Endpoints.changeRequests,
      queryParameters: {'mine': 'true'},
    );
    final data = res.data;
    final list = data is Map<String, dynamic>
        ? (data['data'] as List<dynamic>? ?? const [])
        : (data as List<dynamic>? ?? const []);
    return list
        .map((e) => ChangeRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `POST /change-requests` — create a draft change request.
  Future<ChangeRequest> create(CreateChangeRequest dto) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.changeRequests,
      data: dto.toJson(),
    );
    return ChangeRequest.fromJson(res.data!);
  }

  /// `POST /change-requests/:id/submit` — draft → submitted.
  Future<void> submit(String id) async {
    await _dio.post<void>(Endpoints.changeRequestSubmit(id));
  }

  /// `GET /reputation/me` — my reputation in the active tenant.
  Future<ContributorReputation> myReputation() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.reputationMe);
    return ContributorReputation.fromJson(res.data!);
  }
}
