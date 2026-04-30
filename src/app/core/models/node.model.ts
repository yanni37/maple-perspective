/**
 * Represents a single node in the mind map graph.
 * - position: absolute {x, y} for canvas rendering
 * - parentId: optional hierarchical parent (tree structure)
 * - linkedIds: non-hierarchical associations (cross-links)
 */
export interface MindMapNode {
  id: string;
  content: string;
  position: { x: number; y: number };
  parentId?: string;
  linkedIds: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
