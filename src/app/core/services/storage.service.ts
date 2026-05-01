import { Injectable, inject, DestroyRef, Injector } from '@angular/core';
import { effect } from '@angular/core';
import { StateService, GraphState } from './state.service';
import type { InboxItem, Meta, MindMapNode, Edge } from '../models';

const STORAGE_KEYS = {
  graph: 'maple_graph',
  inbox: 'maple_inbox',
  meta: 'maple_meta',
} as const;

const AUTO_SAVE_DELAY = 2000; // ms debounce

export interface AppSnapshot {
  graph: GraphState;
  inbox: InboxItem[];
  meta: Meta;
  exportedAt: string;
}

export interface MergeDiffReport {
  newNodes: string[];
  updatedNodes: string[];
  skippedNodes: string[];
  newEdges: string[];
  duplicateNodes: string[];
  duplicateEdges: string[];
  inboxAdded: string[];
  inboxSkipped: string[];
}

interface MergePlan {
  graph: GraphState;
  inbox: InboxItem[];
  meta: Meta;
  diff: MergeDiffReport;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private state = inject(StateService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call once at app boot (e.g. in APP_INITIALIZER or root component). */
  init(): void {
    this.restore();
    this.setupAutoSave();
  }

  // ─── Restore from localStorage ────────────────────────────────────
  private restore(): void {
    try {
      const graph = this.read<GraphState>(STORAGE_KEYS.graph);
      const inbox = this.read<InboxItem[]>(STORAGE_KEYS.inbox);
      const meta = this.read<Meta>(STORAGE_KEYS.meta);

      if (graph || inbox || meta) {
        this.state.loadState(
          graph ?? { nodes: [], edges: [] },
          inbox ?? [],
          meta ?? { lastBackupAt: null, dirty: false, pendingCount: inbox?.length ?? 0 },
        );
      }
    } catch (e) {
      console.warn('[StorageService] Failed to restore state:', e);
    }
  }

  // ─── Auto-save on dirty ───────────────────────────────────────────
  private setupAutoSave(): void {
    effect(() => {
      const meta = this.state.meta();
      if (meta.dirty) {
        this.debounceSave();
      }
    }, { injector: this.injector });

    window.addEventListener('beforeunload', () => this.saveNow());

    this.destroyRef.onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
    });
  }

  private debounceSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), AUTO_SAVE_DELAY);
  }

  /** Persist current state to localStorage and mark clean. */
  saveNow(): void {
    try {
      const graph = this.state.graph();
      const inbox = this.state.inbox();
      this.write(STORAGE_KEYS.graph, graph);
      this.write(STORAGE_KEYS.inbox, inbox);
      this.write(STORAGE_KEYS.meta, { ...this.state.meta(), dirty: false });
      this.state.markClean();
    } catch (e) {
      console.error('[StorageService] Save failed:', e);
    }
  }

  // ─── Import / Export (iCloud JSON) ────────────────────────────────

  /** Export full snapshot as JSON string (for iCloud/file save). */
  exportJSON(): string {
    const snapshot: AppSnapshot = {
      graph: this.state.graph(),
      inbox: this.state.inbox(),
      meta: this.state.meta(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(snapshot, null, 2);
  }

  /** Download snapshot as .json file. */
  downloadBackup(): void {
    const json = this.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maple-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import a snapshot from JSON string (from file picker / iCloud). Replaces all data. */
  importJSON(json: string): boolean {
    try {
      const snapshot: AppSnapshot = JSON.parse(json);
      if (!snapshot.graph || !Array.isArray(snapshot.graph.nodes)) {
        throw new Error('Invalid snapshot format');
      }
      this.state.loadState(
        snapshot.graph,
        snapshot.inbox ?? [],
        snapshot.meta ?? { lastBackupAt: null, dirty: false, pendingCount: 0 },
      );
      this.saveNow();
      return true;
    } catch (e) {
      console.error('[StorageService] Import failed:', e);
      return false;
    }
  }

  /** Compute merge diff without applying changes. */
  getMergeDiff(json: string): MergeDiffReport | null {
    try {
      const snapshot = this.parseSnapshot(json);
      const plan = this.buildMergePlan(snapshot);
      return plan.diff;
    } catch (e) {
      console.error('[StorageService] Diff failed:', e);
      return null;
    }
  }

  /** Merge a snapshot into the existing state (deterministic, no hidden side effects). */
  mergeJSON(json: string): boolean {
    try {
      const snapshot = this.parseSnapshot(json);
      const plan = this.buildMergePlan(snapshot);

      this.state.loadState(plan.graph, plan.inbox, plan.meta);
      this.saveNow();
      return true;
    } catch (e) {
      console.error('[StorageService] Merge failed:', e);
      return false;
    }
  }

  /** Import pending ideas from a Siri/Shortcuts JSON file. */
  importInboxJSON(json: string): number {
    try {
      const items: Array<{ content?: string; text?: string }> = JSON.parse(json);
      if (!Array.isArray(items)) return 0;

      const existingHashes = new Set(this.state.inbox().map(i => this.contentHash(i.content)));

      let count = 0;
      for (const item of items) {
        const content = (item.content || item.text || '').trim();
        if (content) {
          const hash = this.contentHash(content);
          if (existingHashes.has(hash)) continue;
          existingHashes.add(hash);
          this.state.addToInbox(content);
          count++;
        }
      }
      this.saveNow();
      return count;
    } catch (e) {
      console.error('[StorageService] Inbox import failed:', e);
      return 0;
    }
  }

  // ─── Low-level helpers ────────────────────────────────────────────
  private write(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private read<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private parseSnapshot(json: string): AppSnapshot {
    const snapshot: AppSnapshot = JSON.parse(json);
    if (!snapshot.graph || !Array.isArray(snapshot.graph.nodes) || !Array.isArray(snapshot.graph.edges)) {
      throw new Error('Invalid snapshot format');
    }
    return snapshot;
  }

  private buildMergePlan(snapshot: AppSnapshot): MergePlan {
    const currentGraph = this.state.graph();
    const currentInbox = this.state.inbox();
    const currentMeta = this.state.meta();
    const now = new Date().toISOString();

    const diff: MergeDiffReport = {
      newNodes: [],
      updatedNodes: [],
      skippedNodes: [],
      newEdges: [],
      duplicateNodes: [],
      duplicateEdges: [],
      inboxAdded: [],
      inboxSkipped: [],
    };

    const currentNodesMap = new Map<string, MindMapNode>(currentGraph.nodes.map(n => [n.id, n]));
    const mergedNodesMap = new Map<string, MindMapNode>(currentGraph.nodes.map(n => [n.id, n]));
    const signatureToCurrentId = new Map<string, string>();

    for (const node of currentGraph.nodes) {
      const signature = this.nodeSignature(node.content, node.parentId);
      if (!signatureToCurrentId.has(signature)) {
        signatureToCurrentId.set(signature, node.id);
      }
    }

    const importedToMergedId = new Map<string, string>();
    const importedNodeIds = new Set(snapshot.graph.nodes.map(n => n.id));

    const sortedImportedNodes = [...snapshot.graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
    for (const importedNode of sortedImportedNodes) {
      const byId = mergedNodesMap.get(importedNode.id);
      const signature = this.nodeSignature(importedNode.content, importedNode.parentId);
      const fallbackId = signatureToCurrentId.get(signature);

      if (byId) {
        importedToMergedId.set(importedNode.id, byId.id);
        let nextNode = byId;
        let updated = false;

        if (byId.content !== importedNode.content) {
          nextNode = { ...nextNode, content: importedNode.content, updatedAt: now };
          updated = true;
        }

        if (updated) {
          mergedNodesMap.set(nextNode.id, nextNode);
          diff.updatedNodes.push(nextNode.id);
        } else {
          diff.skippedNodes.push(importedNode.id);
        }

        diff.duplicateNodes.push(importedNode.id);
        continue;
      }

      if (fallbackId) {
        importedToMergedId.set(importedNode.id, fallbackId);
        const existing = mergedNodesMap.get(fallbackId);
        if (existing && existing.content !== importedNode.content) {
          mergedNodesMap.set(fallbackId, { ...existing, content: importedNode.content, updatedAt: now });
          diff.updatedNodes.push(fallbackId);
        } else {
          diff.skippedNodes.push(importedNode.id);
        }
        diff.duplicateNodes.push(importedNode.id);
        continue;
      }

      const resolvedParentId = importedNode.parentId ? importedToMergedId.get(importedNode.parentId) : undefined;
      const newNode: MindMapNode = {
        ...importedNode,
        parentId: resolvedParentId,
        linkedIds: importedNode.linkedIds
          .map(id => importedToMergedId.get(id) ?? (mergedNodesMap.has(id) ? id : null))
          .filter((id): id is string => Boolean(id)),
      };

      mergedNodesMap.set(newNode.id, newNode);
      signatureToCurrentId.set(signature, newNode.id);
      importedToMergedId.set(importedNode.id, newNode.id);
      diff.newNodes.push(newNode.id);
    }

    const mergedEdgeMap = new Map<string, Edge>();
    for (const edge of currentGraph.edges) {
      const key = this.edgeKey(edge.sourceId, edge.targetId, edge.type);
      if (!mergedEdgeMap.has(key)) {
        mergedEdgeMap.set(key, edge);
      }
    }

    const sortedImportedEdges = [...snapshot.graph.edges].sort((a, b) => this.edgeKey(a.sourceId, a.targetId, a.type).localeCompare(this.edgeKey(b.sourceId, b.targetId, b.type)));
    for (const edge of sortedImportedEdges) {
      const sourceId = importedToMergedId.get(edge.sourceId) ?? (mergedNodesMap.has(edge.sourceId) ? edge.sourceId : null);
      const targetId = importedToMergedId.get(edge.targetId) ?? (mergedNodesMap.has(edge.targetId) ? edge.targetId : null);

      if (!sourceId || !targetId) {
        diff.duplicateEdges.push(this.edgeKey(edge.sourceId, edge.targetId, edge.type));
        continue;
      }

      const key = this.edgeKey(sourceId, targetId, edge.type);
      if (mergedEdgeMap.has(key)) {
        diff.duplicateEdges.push(key);
        continue;
      }

      mergedEdgeMap.set(key, { sourceId, targetId, type: edge.type });
      diff.newEdges.push(key);
    }

    const cleanEdges = [...mergedEdgeMap.values()].filter(edge => {
      const valid = mergedNodesMap.has(edge.sourceId) && mergedNodesMap.has(edge.targetId);
      if (!valid) {
        diff.duplicateEdges.push(this.edgeKey(edge.sourceId, edge.targetId, edge.type));
      }
      return valid;
    });

    const inboxHashes = new Set(currentInbox.map(item => this.contentHash(item.content)));
    const inboxIds = new Set(currentInbox.map(item => item.id));
    const mergedInbox = [...currentInbox];

    for (const importedItem of snapshot.inbox ?? []) {
      const hash = this.contentHash(importedItem.content);
      if (inboxIds.has(importedItem.id) || inboxHashes.has(hash)) {
        diff.inboxSkipped.push(importedItem.id);
        continue;
      }
      mergedInbox.push(importedItem);
      inboxIds.add(importedItem.id);
      inboxHashes.add(hash);
      diff.inboxAdded.push(importedItem.id);
    }

    const finalNodes = [...mergedNodesMap.values()].map(node => {
      const linked = node.linkedIds.filter(id => mergedNodesMap.has(id));
      const uniqueLinked = Array.from(new Set(linked));
      return uniqueLinked.length === node.linkedIds.length ? node : { ...node, linkedIds: uniqueLinked };
    });

    const finalGraph: GraphState = {
      nodes: finalNodes,
      edges: cleanEdges,
    };

    const finalMeta: Meta = {
      ...currentMeta,
      pendingCount: mergedInbox.length,
      dirty: true,
    };

    return {
      graph: finalGraph,
      inbox: mergedInbox,
      meta: finalMeta,
      diff,
    };
  }

  private edgeKey(sourceId: string, targetId: string, type: Edge['type']): string {
    return `${sourceId}-${targetId}-${type}`;
  }

  private nodeSignature(content: string, parentId?: string): string {
    const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
    const nodeType = parentId ? 'child' : 'root';
    return `${normalized}|${nodeType}`;
  }

  private contentHash(content: string): string {
    return content.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
