import 'package:flutter_test/flutter_test.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

TreeNode _n(String id) => TreeNode(
      id: id,
      name: id,
      gender: 'male',
      isDeceased: false,
      childrenCount: 0,
    );

void main() {
  group('TreeResponse.mergeWith (incremental load)', () {
    test('de-duplicates nodes and edges', () {
      final base = TreeResponse(
        nodes: [_n('A'), _n('B')],
        edges: const [TreeEdge(parentId: 'A', childId: 'B', via: 'father')],
        truncated: true,
      );
      final expansion = TreeResponse(
        nodes: [_n('B'), _n('C')],
        edges: const [
          TreeEdge(parentId: 'A', childId: 'B', via: 'father'),
          TreeEdge(parentId: 'B', childId: 'C', via: 'father'),
        ],
        truncated: false,
      );

      final merged = base.mergeWith(expansion);

      expect(merged.nodes.map((n) => n.id).toSet(), {'A', 'B', 'C'});
      expect(merged.edges.length, 2);
      // Truncation reflects the latest fetch.
      expect(merged.truncated, isFalse);
    });

    test('round-trips through json', () {
      final tree = TreeResponse(
        nodes: [_n('A')],
        edges: const [],
        truncated: false,
      );
      final restored = TreeResponse.fromJson(tree.toJson());
      expect(restored.nodes.single.id, 'A');
    });
  });
}
