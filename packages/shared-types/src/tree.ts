import type { Gender } from './person';

/** Compact tree node — display fields only, produced AFTER the Visibility Resolver (M3). */
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
  /** which parent link this edge represents */
  via: 'father' | 'mother';
}

export interface TreeResponse {
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** true when more generations exist beyond what was returned (lazy expansion) */
  truncated: boolean;
}
