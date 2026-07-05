import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/view_request/domain/view_request_models.dart';

class ViewRequestState {
  const ViewRequestState({this.busy = false, this.done = false, this.errorKey});

  final bool busy;
  final bool done;
  final String? errorKey;
}

final viewRequestControllerProvider =
    NotifierProvider<ViewRequestController, ViewRequestState>(
  ViewRequestController.new,
);

class ViewRequestController extends Notifier<ViewRequestState> {
  @override
  ViewRequestState build() => const ViewRequestState();

  Future<void> submit(CreateViewRequest dto) async {
    state = const ViewRequestState(busy: true);
    try {
      await ref.read(viewRequestApiProvider).submit(dto);
      state = const ViewRequestState(done: true);
    } on ApiException catch (e) {
      state = ViewRequestState(errorKey: e.messageKey);
    } on Object {
      state = const ViewRequestState(errorKey: 'common.unknownError');
    }
  }
}
