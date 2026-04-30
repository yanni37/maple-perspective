import { Injectable, signal, computed } from '@angular/core';
import { MindMapNode, Edge, InboxItem, Meta } from '../models';

export interface GraphState {
  nodes: MindMapNode[];
  edges: Edge[];
}

@Injectable({ providedIn: 'root' })
export class StateService {
  // ─── Single source of truth ───────────────────────────────────────
  private readonly _graph = signal<GraphState>({ nodes: [], edges: [] });
  private readonly _inbox = signal<InboxItem[]>([]);
  private readonly _meta = signal<Meta>({
    lastBackupAt: null,
    dirty: false,
    pendingCount: 0,
  });

  // ─── Public read-only signals ─────────────────────────────────────
  readonly graph = this._graph.asReadonly();
  readonly inbox = this._inbox.asReadonly();
  readonly meta = this._meta.asReadonly();

  readonly nodes = computed(() => this._graph().nodes);
  readonly edges = computed(() => this._graph().edges);

  // ─── Node operations ──────────────────────────────────────────────

  /** Add a new root node at the given position. */
  addNode(content: string, position: { x: number; y: number }): MindMapNode {
    const now = new Date().toISOString();
    const node: MindMapNode = {
      id: crypto.randomUUID(),
      content,
      position,
      linkedIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this._graph.update(g => ({
      ...g,
      nodes: [...g.nodes, node],
    }));
    this.markDirty();
    return node;
  }

  /** Add a child node linked hierarchically to a parent. */
  addChild(parentId: string, content: string, position: { x: number; y: number }): MindMapNode {
    const now = new Date().toISOString();
    const child: MindMapNode = {
      id: crypto.randomUUID(),
      content,
      position,
      parentId,
      linkedIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const edge: Edge = { sourceId: parentId, targetId: child.id, type: 'parent-child' };

    this._graph.update(g => ({
      nodes: [...g.nodes, child],
      edges: [...g.edges, edge],
    }));
    this.markDirty();
    return child;
  }

  /** Create a bidirectional associative link between two existing nodes. */
  linkNodes(nodeIdA: string, nodeIdB: string): void {
    const edge: Edge = { sourceId: nodeIdA, targetId: nodeIdB, type: 'link' };

    this._graph.update(g => ({
      nodes: g.nodes.map(n => {
        if (n.id === nodeIdA) return { ...n, linkedIds: [...n.linkedIds, nodeIdB], updatedAt: new Date().toISOString() };
        if (n.id === nodeIdB) return { ...n, linkedIds: [...n.linkedIds, nodeIdA], updatedAt: new Date().toISOString() };
        return n;
      }),
      edges: [...g.edges, edge],
    }));
    this.markDirty();
  }

  /** Update a node's position (after drag). */
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    this._graph.update(g => ({
      ...g,
      nodes: g.nodes.map(n =>
        n.id === nodeId ? { ...n, position, updatedAt: new Date().toISOString() } : n
      ),
    }));
    this.markDirty();
  }

  /** Update a node's content text. */
  updateNodeContent(nodeId: string, content: string): void {
    this._graph.update(g => ({
      ...g,
      nodes: g.nodes.map(n =>
        n.id === nodeId ? { ...n, content, updatedAt: new Date().toISOString() } : n
      ),
    }));
    this.markDirty();
  }

  /** Remove a node and all its connected edges. */
  removeNode(nodeId: string): void {
    this._graph.update(g => ({
      nodes: g.nodes.filter(n => n.id !== nodeId),
      edges: g.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId),
    }));
    this.markDirty();
  }

  // ─── Inbox operations ─────────────────────────────────────────────

  /** Capture a quick idea into the inbox. */
  addToInbox(content: string): InboxItem {
    const item: InboxItem = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this._inbox.update(items => [...items, item]);
    this._meta.update(m => ({ ...m, pendingCount: m.pendingCount + 1, dirty: true }));
    return item;
  }

  /** Remove an inbox item without promoting it. */
  removeFromInbox(itemId: string): void {
    this._inbox.update(items => items.filter(i => i.id !== itemId));
    this._meta.update(m => ({ ...m, pendingCount: Math.max(0, m.pendingCount - 1), dirty: true }));
  }

  /** Promote an inbox item to a graph node, removing it from the inbox. */
  promoteFromInbox(itemId: string, position: { x: number; y: number }): MindMapNode | null {
    const item = this._inbox().find(i => i.id === itemId);
    if (!item) return null;

    this._inbox.update(items => items.filter(i => i.id !== itemId));
    this._meta.update(m => ({ ...m, pendingCount: Math.max(0, m.pendingCount - 1) }));

    return this.addNode(item.content, position);
  }

  // ─── Meta helpers ─────────────────────────────────────────────────

  private markDirty(): void {
    this._meta.update(m => ({ ...m, dirty: true }));
  }

  /** Called after a successful save/backup. */
  markClean(): void {
    this._meta.update(m => ({ ...m, dirty: false, lastBackupAt: new Date().toISOString() }));
  }

  // ─── Bulk load (for restoring from localStorage) ──────────────────

  loadState(graph: GraphState, inbox: InboxItem[], meta: Meta): void {
    this._graph.set(graph);
    this._inbox.set(inbox);
    this._meta.set(meta);
  }
}
