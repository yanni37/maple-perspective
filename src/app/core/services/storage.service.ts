import { Injectable, inject, DestroyRef, Injector } from '@angular/core';
import { effect } from '@angular/core';
import { StateService, GraphState } from './state.service';
import type { InboxItem, Meta } from '../models';

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

      console.log('[StorageService] Restoring:', { graph: !!graph, inbox: !!inbox, meta: !!meta });

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
      console.log('[StorageService] Saved:', graph.nodes.length, 'nodes');
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

  /** Import a snapshot from JSON string (from file picker / iCloud). */
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

  /** Import pending ideas from a Siri/Shortcuts JSON file. */
  importInboxJSON(json: string): number {
    try {
      const items: Array<{ content?: string; text?: string }> = JSON.parse(json);
      if (!Array.isArray(items)) return 0;

      let count = 0;
      for (const item of items) {
        const content = item.content || item.text;
        if (content && typeof content === 'string') {
          this.state.addToInbox(content.trim());
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
}
