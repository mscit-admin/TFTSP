// Local mirror of packages/shared-types/src/tree.ts.
import type { Gender } from './person';

export interface TreeNode {
  id: string;
  name: string;
  gender: Gender;
  isDeceased: boolean;
  childrenCount: number;
}

export interface TreeEdge {
  parentId: string;
  childId: string;
  via: 'father' | 'mother';
}

export interface TreeResponse {
  nodes: TreeNode[];
  edges: TreeEdge[];
  truncated: boolean;
}
