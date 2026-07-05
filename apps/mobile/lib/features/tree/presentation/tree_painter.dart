import 'package:flutter/material.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_layout.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

/// Renders the family tree: parent→child connectors, then node discs + labels.
///
/// RTL is handled by mirroring the x axis, so the same layout drives both
/// directions and the toggle is instant. Repaint is gated on data identity, so
/// pinch-zoom/pan (handled by an ancestor [InteractiveViewer]) never triggers a
/// repaint — keeping it smooth on large trees.
class TreePainter extends CustomPainter {
  TreePainter({
    required this.layout,
    required this.nodes,
    required this.edges,
    required this.colors,
    required this.rtl,
    required this.highlightId,
  });

  final TreeLayout layout;
  final Map<String, TreeNode> nodes;
  final List<TreeEdge> edges;
  final ColorScheme colors;
  final bool rtl;
  final String? highlightId;

  double _x(double x, Size size) => rtl ? size.width - x : x;

  @override
  void paint(Canvas canvas, Size size) {
    final edgePaint = Paint()
      ..color = colors.outline
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    // Edges first.
    for (final e in edges) {
      final p = layout.positions[e.parentId];
      final c = layout.positions[e.childId];
      if (p == null || c == null) continue;
      final parent = Offset(_x(p.dx, size), p.dy);
      final child = Offset(_x(c.dx, size), c.dy);
      final mid = (parent.dy + child.dy) / 2;
      final path = Path()
        ..moveTo(parent.dx, parent.dy)
        ..lineTo(parent.dx, mid)
        ..lineTo(child.dx, mid)
        ..lineTo(child.dx, child.dy);
      canvas.drawPath(path, edgePaint);
    }

    // Nodes.
    for (final entry in layout.positions.entries) {
      final node = nodes[entry.key];
      if (node == null) continue;
      final center = Offset(_x(entry.value.dx, size), entry.value.dy);
      _paintNode(canvas, center, node, active: entry.key == highlightId);
    }
  }

  void _paintNode(
    Canvas canvas,
    Offset center,
    TreeNode node, {
    required bool active,
  }) {
    final isFemale = node.gender == 'female';
    final fill = isFemale ? colors.tertiaryContainer : colors.primaryContainer;
    final onFill =
        isFemale ? colors.onTertiaryContainer : colors.onPrimaryContainer;

    final deceasedFill = Color.lerp(fill, colors.surface, 0.35) ?? fill;
    final circle = Paint()..color = node.isDeceased ? deceasedFill : fill;
    canvas.drawCircle(center, layout.nodeRadius, circle);

    final border = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = active ? 3.5 : 1.5
      ..color = active ? colors.primary : colors.outlineVariant;
    canvas.drawCircle(center, layout.nodeRadius, border);

    // Name label under the disc.
    final tp = TextPainter(
      text: TextSpan(
        text: node.name,
        style: TextStyle(
          color: onFill,
          fontSize: 12,
          fontWeight: active ? FontWeight.bold : FontWeight.w500,
        ),
      ),
      textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
      textAlign: TextAlign.center,
      maxLines: 2,
      ellipsis: '…',
    )..layout(maxWidth: layout.nodeRadius * 3);
    tp.paint(
      canvas,
      Offset(center.dx - tp.width / 2, center.dy + layout.nodeRadius + 2),
    );

    // Children-count badge when the node has hidden descendants.
    if (node.childrenCount > 0) {
      final badgeCenter = Offset(
        center.dx + layout.nodeRadius * 0.7,
        center.dy - layout.nodeRadius * 0.7,
      );
      canvas.drawCircle(badgeCenter, 9, Paint()..color = colors.secondary);
      final bp = TextPainter(
        text: TextSpan(
          text: '${node.childrenCount}',
          style: TextStyle(color: colors.onSecondary, fontSize: 10),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      bp.paint(
        canvas,
        Offset(badgeCenter.dx - bp.width / 2, badgeCenter.dy - bp.height / 2),
      );
    }
  }

  @override
  bool shouldRepaint(TreePainter oldDelegate) =>
      oldDelegate.layout != layout ||
      oldDelegate.nodes != nodes ||
      oldDelegate.rtl != rtl ||
      oldDelegate.highlightId != highlightId ||
      oldDelegate.colors != colors;
}
