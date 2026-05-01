import { Component, computed, inject, Input } from '@angular/core';
import { StateService } from '../../../core/services';
import type { Edge, MindMapNode } from '../../../core/models';

export interface EdgeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: Edge['type'];
  d: string; // SVG cubic Bézier path
  color: string; // branch color (parent-child) or link green
  sourceId: string;
  targetId: string;
}

// Color palette for parent-child branches (deterministic by parent ID)
const BRANCH_COLORS = [
  '#7B8AFF', // laser indigo
  '#FF2D95', // magenta fluo
  '#00FF88', // vert fluo
  '#FFD000', // jaune fluo
  '#C84DFF', // violet fluo
  '#00FFFF', // cyan fluo
  '#FF5500', // orange fluo
  '#33AAFF', // bleu fluo
];

function hashBranchId(branchId: string): number {
  let hash = 0;
  for (let i = 0; i < branchId.length; i++) {
    hash = ((hash << 5) - hash) + branchId.charCodeAt(i);
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash) % BRANCH_COLORS.length;
}

/**
 * Find the "branch root" - the topmost child in the inheritance chain.
 * E.g., if node C has parent B, and B has parent A, then find A.
 * The returned branchId is the child of the root that leads to this node.
 */
function findBranchId(nodeId: string, nodeMap: Map<string, MindMapNode>): string {
  const node = nodeMap.get(nodeId);
  if (!node || !node.parentId) return nodeId; // no parent = this node is the branch root

  let current = node;
  let previous = current;

  // Walk up the chain until we hit a node with no parent (the root)
  while (current.parentId) {
    previous = current;
    const parent = nodeMap.get(current.parentId);
    if (!parent) break; // parent doesn't exist
    current = parent;
  }

  // Return the child of the root (or the original if no parent chain exists)
  return previous.id;
}

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const cx = Math.max(dx * 0.5, 60);
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
}

@Component({
  selector: 'app-edges',
  standalone: true,
  template: `
    <svg class="edges-layer">
      @for (edge of edgeLines(); track $index) {
        <path
          [attr.d]="edge.d"
          [class.link]="edge.type === 'link'"
          [class.dimmed]="isDimmed(edge)"
          [style.stroke]="edge.color"
        />
      }


    </svg>
  `,
  styles: [`
    :host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .edges-layer { width: 100%; height: 100%; overflow: visible; }
    path {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .link { stroke-dasharray: 6 4; }
    path { transition: opacity 0.2s; }
    path.dimmed { opacity: 0.12; }
  `],
})
export class EdgesComponent {
  private state = inject(StateService);

  @Input() focusedId: string | null = null;

  isDimmed(edge: EdgeLine): boolean {
    if (!this.focusedId) return false;
    return edge.sourceId !== this.focusedId && edge.targetId !== this.focusedId;
  }

  readonly edgeLines = computed<EdgeLine[]>(() => {
    const nodes = this.state.nodes();
    const edges = this.state.edges();
    const nodeMap = new Map<string, MindMapNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    return edges
      .map(e => {
        const source = nodeMap.get(e.sourceId);
        const target = nodeMap.get(e.targetId);
        if (!source || !target) return null;
        const x1 = source.position.x + 40;
        const y1 = source.position.y + 16;
        const x2 = target.position.x + 40;
        const y2 = target.position.y + 16;
        
        let color = '#A0A0AB'; // muted for links
        if (e.type === 'parent-child') {
          const branchId = findBranchId(target.id, nodeMap);
          color = BRANCH_COLORS[hashBranchId(branchId)];
        }
        
        return {
          x1, y1, x2, y2,
          type: e.type,
          d: cubicPath(x1, y1, x2, y2),
          color,
          sourceId: e.sourceId,
          targetId: e.targetId,
        } satisfies EdgeLine;
      })
      .filter((e): e is EdgeLine => e !== null);
  });
}
