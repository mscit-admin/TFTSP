import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/features/person/domain/person_models.dart';

class PersonApi {
  PersonApi(this._dio);

  final Dio _dio;

  /// `GET /persons/:id` — already resolved by the Visibility Resolver; blocked
  /// fields are simply absent.
  Future<Person> fetch(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.person(id));
    return Person.fromJson(res.data!);
  }

  /// `GET /persons/:id/documents` — presigned download URLs (15-min TTL).
  Future<List<PersonDocument>> documents(String id) async {
    final res =
        await _dio.get<List<dynamic>>(Endpoints.personDocuments(id));
    final list = res.data ?? const [];
    return list
        .map((e) => PersonDocument.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /persons/:id/ancestors` — lineage path to root (closure table).
  Future<List<LineageEntry>> ancestors(String id) async {
    final res =
        await _dio.get<List<dynamic>>(Endpoints.personAncestors(id));
    final list = res.data ?? const [];
    return list
        .map((e) => LineageEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
