/// Tree domain models — mirror `packages/shared-types/src/tree.ts`.
/// These are the compact, post-Visibility-Resolver display shapes.
library;

class TreeNode {
  const TreeNode({
    required this.id,
    required this.name,
    required this.gender,
    required this.isDeceased,
    required this.childrenCount,
  });

  final String id;
  final String name;

  /// 'male' | 'female'
  final String gender;
  final bool isDeceased;
  final int childrenCount;

  factory TreeNode.fromJson(Map<String, dynamic> json) => TreeNode(
        id: json['id'] as String,
        name: json['name'] as String,
        gender: json['gender'] as String? ?? 'male',
        isDeceased: json['isDeceased'] as bool? ?? false,
        childrenCount: json['childrenCount'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'gender': gender,
        'isDeceased': isDeceased,
        'childrenCount': childrenCount,
      };
}

class TreeEdge {
  const TreeEdge({
    required this.parentId,
    required this.childId,
    required this.via,
  });

  final String parentId;
  final String childId;

  /// 'father' | 'mother'
  final String via;

  factory TreeEdge.fromJson(Map<String, dynamic> json) => TreeEdge(
        parentId: json['parentId'] as String,
        childId: json['childId'] as String,
        via: json['via'] as String? ?? 'father',
      );

  Map<String, dynamic> toJson() => {
        'parentId': parentId,
        'childId': childId,
        'via': via,
      };
}

class TreeResponse {
  const TreeResponse({
    required this.nodes,
    required this.edges,
    required this.truncated,
  });

  final List<TreeNode> nodes;
  final List<TreeEdge> edges;
  final bool truncated;

  factory TreeResponse.fromJson(Map<String, dynamic> json) => TreeResponse(
        nodes: (json['nodes'] as List<dynamic>? ?? const [])
            .map((e) => TreeNode.fromJson(e as Map<String, dynamic>))
            .toList(),
        edges: (json['edges'] as List<dynamic>? ?? const [])
            .map((e) => TreeEdge.fromJson(e as Map<String, dynamic>))
            .toList(),
        truncated: json['truncated'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'nodes': nodes.map((n) => n.toJson()).toList(),
        'edges': edges.map((e) => e.toJson()).toList(),
        'truncated': truncated,
      };

  /// Merge another response into this one (incremental / lazy expansion),
  /// de-duplicating by node id and edge (parent,child,via).
  TreeResponse mergeWith(TreeResponse other) {
    final nodeMap = <String, TreeNode>{for (final n in nodes) n.id: n};
    for (final n in other.nodes) {
      nodeMap[n.id] = n;
    }
    final edgeKeys = <String>{};
    final mergedEdges = <TreeEdge>[];
    for (final e in [...edges, ...other.edges]) {
      final key = '${e.parentId}>${e.childId}:${e.via}';
      if (edgeKeys.add(key)) mergedEdges.add(e);
    }
    return TreeResponse(
      nodes: nodeMap.values.toList(),
      edges: mergedEdges,
      truncated: other.truncated,
    );
  }
}
