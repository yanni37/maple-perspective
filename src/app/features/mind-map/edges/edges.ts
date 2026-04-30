import { Component, computed, inject } from '@angular/core';
import { StateService } from '../../../core/services';
import type { Edge, MindMapNode } from '../../../core/models';

export interface EdgeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: Edge['type'];
}

@Component({
  selector: 'app-edges',
  standalone: true,
  template: `
    <svg class="edges-layer">
      @for (edge of edgeLines(); track $index) {
        <line
          [attr.x1]="edge.x1"
          [attr.y1]="edge.y1"
          [attr.x2]="edge.x2"
          [attr.y2]="edge.y2"
          [class.parent-child]="edge.type === 'parent-child'"
          [class.link]="edge.type === 'link'"
        />
      }

      @if (draft(); as d) {
        <line class="draft" [attr.x1]="d.x1" [attr.y1]="d.y1" [attr.x2]="d.x2" [attr.y2]="d.y2" />
      }
    </svg>
  `,
  styles: [`
    :host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .edges-layer { width: 100%; height: 100%; overflow: visible; }
    line {
      stroke-width: 2;
      stroke-linecap: round;
    }
    .parent-child { stroke: #89b4fa; }
    .link { stroke: #a6e3a1; stroke-dasharray: 6 4; }
    .draft { stroke: #f9e2af; stroke-dasharray: 4 4; opacity: 0.7; }
  `],
})
export class EdgesComponent {
  private state = inject(StateService);

  // Exposed so canvas can set the draft edge during link-drag
  readonly draft = computed(() => this._draft());
  _draft = computed<EdgeLine | null>(() => null); // overridden at runtime via signal

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
        return {
          x1: source.position.x + 40, // rough center offset
          y1: source.position.y + 16,
          x2: target.position.x + 40,
          y2: target.position.y + 16,
          type: e.type,
        } satisfies EdgeLine;
      })
      .filter((e): e is EdgeLine => e !== null);
  });
}
