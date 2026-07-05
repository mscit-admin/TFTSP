import 'dart:ui';

import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

/// Result of laying out a [TreeResponse] into 2D positions.
class TreeLayout {
  const TreeLayout({
    required this.positions,
    required this.size,
    required this.nodeRadius,
  });

  /// Node id → centre position (logical pixels).
  final Map<String, Offset> positions;

  /// Total bounding size of the drawn tree (before zoom).
  final Size size;

  final double nodeRadius;

  bool get isEmpty => positions.isEmpty;

  /// Hit-test: the id of the node whose circle contains [point], or null.
  String? nodeAt(Offset point) {
    for (final entry in positions.entries) {
      if ((entry.value - point).distance <= nodeRadius) return entry.key;
    }
    return null;
  }
}

/// Pure, deterministic vertical tree layout (top-down).
///
/// - Generation (depth) is assigned by a DFS from the roots (nodes that are
///   never a child).
/// - Leaves are packed left-to-right; each internal node is centred over its
///   visible children (classic tidy-ish layout, single pass).
/// - Multi-parent nodes (father + mother edges) are placed once (first visit),
///   so a genealogical DAG never loops or double-draws.
///
/// Complexity is O(V + E); comfortably handles 2,000 nodes.
TreeLayout computeTreeLayout(
  TreeResponse tree, {
  double horizontalGap = 96,
  double verticalGap = 132,
  double nodeRadius = 30,
  double padding = 24,
}) {
  final nodeIds = <String>{for (final n in tree.nodes) n.id};
  final children = <String, List<String>>{};
  final childIds = <String>{};

  for (final e in tree.edges) {
    if (!nodeIds.contains(e.parentId) || !nodeIds.contains(e.childId)) continue;
    children.putIfAbsent(e.parentId, () => <String>[]).add(e.childId);
    childIds.add(e.childId);
  }

  final roots = tree.nodes
      .map((n) => n.id)
      .where((id) => !childIds.contains(id))
      .toList();
  final effectiveRoots =
      roots.isEmpty && tree.nodes.isNotEmpty ? [tree.nodes.first.id] : roots;

  final depth = <String, int>{};
  final xUnit = <String, double>{};
  final visited = <String>{};
  var nextLeaf = 0.0;

  double assign(String id, int d) {
    if (visited.contains(id)) return xUnit[id] ?? 0;
    visited.add(id);
    depth[id] = d;

    final kids = children[id] ?? const <String>[];
    final kidXs = <double>[];
    for (final k in kids) {
      if (visited.contains(k)) continue;
      kidXs.add(assign(k, d + 1));
    }

    final double x;
    if (kidXs.isEmpty) {
      x = nextLeaf;
      nextLeaf += 1;
    } else {
      x = (kidXs.first + kidXs.last) / 2.0;
    }
    xUnit[id] = x;
    return x;
  }

  for (final r in effectiveRoots) {
    assign(r, 0);
  }
  // Any leftover (disconnected) nodes become their own roots.
  for (final n in tree.nodes) {
    if (!visited.contains(n.id)) assign(n.id, 0);
  }

  final positions = <String, Offset>{};
  var maxX = 0.0;
  var maxDepth = 0;
  for (final n in tree.nodes) {
    final ux = xUnit[n.id] ?? 0;
    final d = depth[n.id] ?? 0;
    final dx = ux * horizontalGap + nodeRadius + padding;
    final dy = d * verticalGap + nodeRadius + padding;
    positions[n.id] = Offset(dx, dy);
    if (ux > maxX) maxX = ux;
    if (d > maxDepth) maxDepth = d;
  }

  final width = maxX * horizontalGap + (nodeRadius + padding) * 2;
  final height = maxDepth * verticalGap + (nodeRadius + padding) * 2;

  return TreeLayout(
    positions: positions,
    size: Size(width, height),
    nodeRadius: nodeRadius,
  );
}
