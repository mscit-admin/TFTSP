import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_layout.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

class TreeViewState {
  const TreeViewState({
    this.tree = const TreeResponse(nodes: [], edges: [], truncated: false),
    this.loading = false,
    this.fromCache = false,
    this.errorKey,
    this.focusNodeId,
  });

  final TreeResponse tree;
  final bool loading;
  final bool fromCache;
  final String? errorKey;

  /// When set, the view should animate the camera to centre this node.
  final String? focusNodeId;

  TreeLayout get layout => computeTreeLayout(tree);

  bool get isEmpty => tree.nodes.isEmpty;

  TreeViewState copyWith({
    TreeResponse? tree,
    bool? loading,
    bool? fromCache,
    String? errorKey,
    String? focusNodeId,
    bool clearError = false,
    bool clearFocus = false,
  }) {
    return TreeViewState(
      tree: tree ?? this.tree,
      loading: loading ?? this.loading,
      fromCache: fromCache ?? this.fromCache,
      errorKey: clearError ? null : (errorKey ?? this.errorKey),
      focusNodeId: clearFocus ? null : (focusNodeId ?? this.focusNodeId),
    );
  }
}

final treeControllerProvider =
    NotifierProvider<TreeController, TreeViewState>(TreeController.new);

class TreeController extends Notifier<TreeViewState> {
  @override
  TreeViewState build() {
    // Rebuild (reset) whenever the active tribe changes.
    ref.watch(activeTenantIdProvider);
    unawaited(Future.microtask(loadRoot));
    return const TreeViewState(loading: true);
  }

  Future<void> loadRoot() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final result = await ref.read(treeRepositoryProvider).load();
      state = state.copyWith(
        tree: result.tree,
        fromCache: result.fromCache,
        loading: false,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, errorKey: e.messageKey);
    }
  }

  /// Incrementally expand a node's descendants and merge into the current tree.
  Future<void> expand(String nodeId) async {
    try {
      final result = await ref
          .read(treeRepositoryProvider)
          .load(rootId: nodeId, generations: 2);
      state = state.copyWith(
        tree: state.tree.mergeWith(result.tree),
        fromCache: result.fromCache,
      );
    } on ApiException catch (e) {
      state = state.copyWith(errorKey: e.messageKey);
    }
  }

  /// In-tree search: returns the first matching node id and asks the view to
  /// move the camera to it. Case-insensitive substring on the display name.
  String? search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      state = state.copyWith(clearFocus: true);
      return null;
    }
    for (final n in state.tree.nodes) {
      if (n.name.toLowerCase().contains(q)) {
        state = state.copyWith(focusNodeId: n.id);
        return n.id;
      }
    }
    state = state.copyWith(clearFocus: true);
    return null;
  }

  void clearFocus() => state = state.copyWith(clearFocus: true);
}
