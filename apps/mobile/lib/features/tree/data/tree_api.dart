import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

class TreeApi {
  TreeApi(this._dio);

  final Dio _dio;

  /// `GET /tree?rootId=&generations=`. When [rootId] is null the backend
  /// returns the tribe's root(s).
  Future<TreeResponse> fetch({String? rootId, int generations = 3}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.tree,
      queryParameters: {
        if (rootId != null) 'rootId': rootId,
        'generations': generations,
      },
    );
    return TreeResponse.fromJson(res.data!);
  }
}
