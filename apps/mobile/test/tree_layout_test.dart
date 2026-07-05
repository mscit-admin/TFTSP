import 'package:flutter_test/flutter_test.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_layout.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

TreeNode _n(String id) =>
    TreeNode(id: id, name: id, gender: 'male', isDeceased: false, childrenCount: 0);

void main() {
  group('computeTreeLayout', () {
    test('empty tree yields empty layout', () {
      final layout = computeTreeLayout(
        const TreeResponse(nodes: [], edges: [], truncated: false),
      );
      expect(layout.isEmpty, isTrue);
    });

    test('parent sits above and centred over its two children', () {
      final tree = TreeResponse(
        nodes: [_n('A'), _n('B'), _n('C')],
        edges: const [
          TreeEdge(parentId: 'A', childId: 'B', via: 'father'),
          TreeEdge(parentId: 'A', childId: 'C', via: 'father'),
        ],
        truncated: false,
      );
      final layout = computeTreeLayout(tree);

      final a = layout.positions['A']!;
      final b = layout.positions['B']!;
      final c = layout.positions['C']!;

      // Parent is one generation above the children.
      expect(a.dy < b.dy, isTrue);
      expect(b.dy, c.dy);

      // Parent x is centred between the two children.
      expect(a.dx, closeTo((b.dx + c.dx) / 2, 0.001));
    });

    test('deeper generations increase y monotonically', () {
      final tree = TreeResponse(
        nodes: [_n('A'), _n('B'), _n('C')],
        edges: const [
          TreeEdge(parentId: 'A', childId: 'B', via: 'father'),
          TreeEdge(parentId: 'B', childId: 'C', via: 'father'),
        ],
        truncated: false,
      );
      final layout = computeTreeLayout(tree);
      final a = layout.positions['A']!;
      final b = layout.positions['B']!;
      final c = layout.positions['C']!;
      expect(a.dy < b.dy, isTrue);
      expect(b.dy < c.dy, isTrue);
    });

    test('hit-testing returns the node under a point', () {
      final tree = TreeResponse(
        nodes: [_n('A')],
        edges: const [],
        truncated: false,
      );
      final layout = computeTreeLayout(tree);
      final pos = layout.positions['A']!;
      expect(layout.nodeAt(pos), 'A');
      // Far away from any node.
      expect(layout.nodeAt(pos.translate(10000, 10000)), isNull);
    });

    test('handles a shared-parent DAG without looping', () {
      // C has two parents (father A, mother B) — must be placed once.
      final tree = TreeResponse(
        nodes: [_n('A'), _n('B'), _n('C')],
        edges: const [
          TreeEdge(parentId: 'A', childId: 'C', via: 'father'),
          TreeEdge(parentId: 'B', childId: 'C', via: 'mother'),
        ],
        truncated: false,
      );
      final layout = computeTreeLayout(tree);
      expect(layout.positions.length, 3);
      expect(layout.positions.containsKey('C'), isTrue);
    });
  });
}
