import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/contributions/domain/contribution_models.dart';

final myRequestsProvider =
    FutureProvider.autoDispose<List<ChangeRequest>>((ref) async {
  ref.watch(activeTenantIdProvider);
  return ref.watch(contributionApiProvider).myRequests();
});

final myReputationProvider =
    FutureProvider.autoDispose<ContributorReputation>((ref) async {
  ref.watch(activeTenantIdProvider);
  return ref.watch(contributionApiProvider).myReputation();
});

/// Submission state for the "suggest a change" form.
class CreateRequestState {
  const CreateRequestState({
    this.busy = false,
    this.done = false,
    this.errorKey,
  });

  final bool busy;
  final bool done;
  final String? errorKey;
}

final createRequestControllerProvider =
    NotifierProvider<CreateRequestController, CreateRequestState>(
  CreateRequestController.new,
);

class CreateRequestController extends Notifier<CreateRequestState> {
  @override
  CreateRequestState build() => const CreateRequestState();

  /// Create + immediately submit a change request. Returns true on success.
  Future<bool> submit({
    required String targetType,
    required String operation,
    required List<JsonPatchOp> patch,
    ContributionType? contributionType,
    String? targetId,
  }) async {
    state = const CreateRequestState(busy: true);
    try {
      final api = ref.read(contributionApiProvider);
      final created = await api.create(
        CreateChangeRequest(
          targetType: targetType,
          operation: operation,
          patch: patch,
          contributionType: contributionType,
          targetId: targetId,
        ),
      );
      await api.submit(created.id);
      ref.invalidate(myRequestsProvider);
      state = const CreateRequestState(done: true);
      return true;
    } on ApiException catch (e) {
      state = CreateRequestState(errorKey: e.messageKey);
      return false;
    } on Object {
      state = const CreateRequestState(errorKey: 'common.unknownError');
      return false;
    }
  }
}
