import { Component, computed, inject, signal } from '@angular/core';
import { StateService, StorageService, InboxUiService } from '../../core/services';

interface ImportDiffView {
  newNodes: number;
  updatedNodes: number;
  skippedNodes: number;
  newEdges: number;
  duplicateNodes: number;
  duplicateEdges: number;
  inboxAdded: number;
  inboxSkipped: number;
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  template: `
    <div class="inbox" [class.collapsed]="ui.collapsed()">
      <div class="inbox-content">
        <div class="inbox-header">
        <h2><svg class="icon icon-header" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg> Inbox ({{ items().length }})</h2>
        </div>
      <div class="inbox-input">
        <input
          #input
          type="text"
          placeholder="Nouvelle idée…"
          (keydown.enter)="add(input)"
        />
        <button (click)="add(input)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg></button>
      </div>

      <ul class="inbox-list">
        @for (item of items(); track item.id) {
          <li class="inbox-item">
            <span class="item-content">{{ item.content }}</span>
            <div class="item-actions">
              <button class="promote" title="Importer dans le graph" (click)="promote(item.id)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg></button>
              <button class="delete" title="Supprimer" (click)="remove(item.id)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
            </div>
          </li>
        } @empty {
          <li class="empty">Aucune idée en attente</li>
        }
      </ul>

      </div>

      @if (showImportModal()) {
        <div class="import-modal-overlay" (click)="cancelImport()"></div>
        <div class="import-modal-sheet" role="dialog" aria-modal="true" aria-label="Import JSON">
          <div class="sheet-handle"></div>
          <h3>Import JSON</h3>
          <p>Choisis le mode d'import :</p>

          <div class="diff-grid">
            <div>newNodes</div><div>{{ importDiff()?.newNodes ?? 0 }}</div>
            <div>updatedNodes</div><div>{{ importDiff()?.updatedNodes ?? 0 }}</div>
            <div>skippedNodes</div><div>{{ importDiff()?.skippedNodes ?? 0 }}</div>
            <div>newEdges</div><div>{{ importDiff()?.newEdges ?? 0 }}</div>
            <div>duplicateNodes</div><div>{{ importDiff()?.duplicateNodes ?? 0 }}</div>
            <div>duplicateEdges</div><div>{{ importDiff()?.duplicateEdges ?? 0 }}</div>
            <div>inboxAdded</div><div>{{ importDiff()?.inboxAdded ?? 0 }}</div>
            <div>inboxSkipped</div><div>{{ importDiff()?.inboxSkipped ?? 0 }}</div>
          </div>

          <div class="modal-actions">
            <button class="replace" (click)="applyReplace()">Replace</button>
            <button class="merge" (click)="applyMerge()">Merge</button>
            <button class="cancel" (click)="cancelImport()">Cancel</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .inbox {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--mp-space-md);
      color: var(--mp-text-primary);
    }
    .inbox.collapsed { padding-top: var(--mp-space-xs); }

    .inbox-content {
      overflow: hidden;
      transition: max-height 320ms var(--mp-ease), opacity 220ms var(--mp-ease);
      max-height: 1200px;
      opacity: 1;
    }
    .inbox.collapsed .inbox-content {
      max-height: 0;
      opacity: 0;
    }

    .inbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--mp-space-sm);
    }
    .inbox-header h2 {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      color: var(--mp-text-primary);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .icon { width: 1em; height: 1em; flex-shrink: 0; }
    .icon-header { width: 1.1rem; height: 1.1rem; }
    .inbox-actions { display: flex; gap: 0.35rem; }
    .import-btn, .export-btn {
      background: transparent;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--mp-radius-xs);
      transition: background var(--mp-transition-fast);
    }
    .import-btn:hover, .export-btn:hover { background: var(--mp-bg-hover); }

    .inbox-input { display: flex; gap: var(--mp-space-sm); }
    .inbox-input input {
      flex: 1;
      padding: 0.45rem 0.75rem;
      border: 1.5px solid var(--mp-glass-border);
      border-radius: var(--mp-radius-sm);
      background: var(--mp-bg-base, #F6F5F1);
      color: var(--mp-text-primary);
      font-size: 0.9rem;
      font-weight: 400;
      outline: none;
      transition: box-shadow var(--mp-transition-fast), border-color var(--mp-transition-fast);
    }
    .inbox-input input::placeholder { color: var(--mp-text-muted); }
    .inbox-input input:focus {
      border-color: var(--mp-accent);
      box-shadow: 0 0 0 3px var(--mp-accent-glow);
    }
    .inbox-input button {
      padding: 0.45rem;
      border: none;
      border-radius: var(--mp-radius-sm);
      background: transparent;
      color: var(--mp-text-secondary);
      font-size: 1rem;
      cursor: pointer;
      min-width: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color var(--mp-transition-fast), opacity var(--mp-transition-fast);
    }
    .inbox-input button:hover { color: var(--mp-accent); }
    .inbox-input button:active { opacity: 0.7; }

    .inbox-list {
      list-style: none;
      margin: var(--mp-space-md) 0 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
    }
    .inbox-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.25rem;
      border-bottom: 1px solid var(--mp-glass-border);
      transition: background var(--mp-transition-fast);
    }
    .inbox-item:hover { background: var(--mp-bg-hover); border-radius: var(--mp-radius-xs); }

    .item-content {
      flex: 1;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--mp-text-primary);
    }
    .item-actions { display: flex; gap: 0.3rem; }
    .item-actions button {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 0.95rem;
      padding: 0.2rem;
      border-radius: var(--mp-radius-xs);
      transition: background var(--mp-transition-fast);
    }
    .item-actions button:hover { background: var(--mp-bg-hover); }
    .promote { color: var(--mp-success, #34A853); }
    .delete  { color: var(--mp-danger, #EA4335); }

    .empty {
      color: var(--mp-text-muted);
      padding: 1.25rem 0;
      text-align: center;
      font-size: 0.85rem;
    }

    .import-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.2);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
      z-index: 900;
    }
    .import-modal-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-height: min(78vh, 560px);
      overflow-y: auto;
      background: var(--mp-bg-elevated, #FFF);
      border-top: 1px solid var(--mp-glass-border);
      border-top-left-radius: var(--mp-radius-lg);
      border-top-right-radius: var(--mp-radius-lg);
      padding: 0.65rem 1rem calc(1rem + env(safe-area-inset-bottom));
      z-index: 901;
      box-shadow: var(--mp-glass-shadow-lg);
      animation: sheet-in 220ms var(--mp-ease);
    }
    .sheet-handle {
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: var(--mp-text-muted);
      opacity: 0.3;
      margin: 0 auto 0.75rem;
    }
    .import-modal-sheet h3 {
      margin: 0 0 0.35rem;
      font-size: 1rem;
      font-weight: 700;
      color: var(--mp-text-primary);
    }
    .import-modal-sheet p {
      margin: 0 0 0.75rem;
      color: var(--mp-text-secondary);
      font-size: 0.85rem;
    }
    @keyframes sheet-in {
      from { transform: translateY(18px); opacity: 0.7; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.35rem 0.75rem;
      font-size: 0.85rem;
      margin-bottom: 0.9rem;
    }
    .diff-grid div:nth-child(odd)  { color: var(--mp-text-secondary); }
    .diff-grid div:nth-child(even) { color: var(--mp-text-primary); font-weight: 600; text-align: right; }

    .modal-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .modal-actions button {
      border: none;
      border-radius: var(--mp-radius-sm);
      padding: 0.6rem 0.5rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: opacity var(--mp-transition-fast);
    }
    .modal-actions button:active { opacity: 0.8; }
    .modal-actions .replace { background: var(--mp-danger); color: var(--mp-text-inverse); }
    .modal-actions .merge   { background: var(--mp-success); color: var(--mp-text-inverse); }
    .modal-actions .cancel  { background: var(--mp-bg-base); color: var(--mp-text-secondary); border: 1px solid var(--mp-glass-border); }
  `],
})
export class InboxComponent {
  private state = inject(StateService);
  private storage = inject(StorageService);
  readonly ui: InboxUiService = inject(InboxUiService);

  readonly items = computed(() => this.state.inbox());
  readonly showImportModal = signal(false);
  readonly importDiff = signal<ImportDiffView | null>(null);
  private pendingImportJSON = signal<string | null>(null);

  add(input: HTMLInputElement): void {
    const content = input.value.trim();
    if (!content) return;
    this.state.addToInbox(content);
    input.value = '';
  }

  promote(itemId: string): void {
    const x = 100 + Math.random() * 200;
    const y = 100 + Math.random() * 200;
    this.state.promoteFromInbox(itemId, { x, y });
  }

  remove(itemId: string): void {
    this.state.removeFromInbox(itemId);
  }

  importFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;

      // Try inbox format first (always additive)
      const count = this.storage.importInboxJSON(json);
      if (count === 0) {
        const diff = this.storage.getMergeDiff(json);
        if (!diff) {
          window.alert('Fichier JSON invalide.');
          return;
        }

        this.pendingImportJSON.set(json);
        this.importDiff.set({
          newNodes: diff.newNodes.length,
          updatedNodes: diff.updatedNodes.length,
          skippedNodes: diff.skippedNodes.length,
          newEdges: diff.newEdges.length,
          duplicateNodes: diff.duplicateNodes.length,
          duplicateEdges: diff.duplicateEdges.length,
          inboxAdded: diff.inboxAdded.length,
          inboxSkipped: diff.inboxSkipped.length,
        });
        this.showImportModal.set(true);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    (event.target as HTMLInputElement).value = '';
  }

  applyReplace(): void {
    const json = this.pendingImportJSON();
    if (!json) return;
    this.storage.importJSON(json);
    this.resetImportModal();
  }

  applyMerge(): void {
    const json = this.pendingImportJSON();
    if (!json) return;
    this.storage.mergeJSON(json);
    this.resetImportModal();
  }

  cancelImport(): void {
    this.resetImportModal();
  }

  private resetImportModal(): void {
    this.showImportModal.set(false);
    this.importDiff.set(null);
    this.pendingImportJSON.set(null);
  }

  exportBackup(): void {
    this.storage.downloadBackup();
  }
}
