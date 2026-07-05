import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/core/l10n/l10n.dart';
import 'package:tftsp_mobile/core/widgets/offline_badge.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';
import 'package:tftsp_mobile/features/tree/presentation/tree_controller.dart';
import 'package:tftsp_mobile/features/tree/presentation/tree_painter.dart';

class TreeScreen extends ConsumerStatefulWidget {
  const TreeScreen({super.key});

  @override
  ConsumerState<TreeScreen> createState() => _TreeScreenState();
}

class _TreeScreenState extends ConsumerState<TreeScreen> {
  final _transform = TransformationController();
  final _search = TextEditingController();
  final _viewportKey = GlobalKey();

  @override
  void dispose() {
    _transform.dispose();
    _search.dispose();
    super.dispose();
  }

  void _moveCameraTo(Offset childPoint) {
    final box =
        _viewportKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final size = box.size;
    const scale = 1.2;
    final dx = size.width / 2 - childPoint.dx * scale;
    final dy = size.height / 3 - childPoint.dy * scale;
    _transform.value = Matrix4.identity()
      ..translate(dx, dy)
      ..scale(scale);
  }

  void _onSearch(String query) {
    final id = ref.read(treeControllerProvider.notifier).search(query);
    if (id == null) {
      if (query.trim().isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('tree.noResults'.tr())),
        );
      }
      return;
    }
    final state = ref.read(treeControllerProvider);
    final rtl = L10n.isRtl(context.locale);
    final pos = state.layout.positions[id];
    if (pos != null) {
      final size = state.layout.size;
      final x = rtl ? size.width - pos.dx : pos.dx;
      _moveCameraTo(Offset(x, pos.dy));
    }
  }

  void _onTapUp(TapUpDetails details, {required bool rtl}) {
    final state = ref.read(treeControllerProvider);
    final size = state.layout.size;
    final local = details.localPosition;
    final x = rtl ? size.width - local.dx : local.dx;
    final id = state.layout.nodeAt(Offset(x, local.dy));
    if (id != null) {
      unawaited(context.push('/person/$id'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(treeControllerProvider);
    final rtl = L10n.isRtl(context.locale);
    final colors = Theme.of(context).colorScheme;
    final nodeMap = <String, TreeNode>{
      for (final n in state.tree.nodes) n.id: n,
    };

    return Column(
      children: [
        const OfflineBadge(),
        Padding(
          padding: const EdgeInsets.all(8),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: _onSearch,
            decoration: InputDecoration(
              hintText: 'tree.searchHint'.tr(),
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        Expanded(
          child: Builder(
            builder: (context) {
              if (state.loading && state.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (state.errorKey != null && state.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(state.errorKey!.tr()),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () => ref
                            .read(treeControllerProvider.notifier)
                            .loadRoot(),
                        child: Text('common.retry'.tr()),
                      ),
                    ],
                  ),
                );
              }
              if (state.isEmpty) {
                return Center(child: Text('common.empty'.tr()));
              }
              final layout = state.layout;
              return RepaintBoundary(
                child: InteractiveViewer(
                  key: _viewportKey,
                  transformationController: _transform,
                  constrained: false,
                  minScale: 0.2,
                  maxScale: 4,
                  boundaryMargin: const EdgeInsets.all(400),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapUp: (d) => _onTapUp(d, rtl: rtl),
                    child: CustomPaint(
                      size: layout.size,
                      painter: TreePainter(
                        layout: layout,
                        nodes: nodeMap,
                        edges: state.tree.edges,
                        colors: colors,
                        rtl: rtl,
                        highlightId: state.focusNodeId,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (state.tree.truncated)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              'tree.truncatedHint'.tr(),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }
}
