/**
 * Represents a connection between two nodes.
 * - "parent-child": hierarchical edge derived from parentId
 * - "link": associative edge derived from linkedIds
 */
export type EdgeType = 'parent-child' | 'link';

export interface Edge {
  sourceId: string;
  targetId: string;
  type: EdgeType;
}
