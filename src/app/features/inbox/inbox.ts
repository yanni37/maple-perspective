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
        <h2>📥 Inbox ({{ items().length }})</h2>
        <div class="inbox-actions">
          <label class="import-btn" title="Importer JSON (Siri)">
            📂
            <input type="file" accept=".json" hidden (change)="importFile($event)" />
          </label>
          <button class="export-btn" title="Exporter backup" (click)="exportBackup()">💾</button>
        </div>
        </div>
      <div class="inbox-input">
        <input
          #input
          type="text"
          placeholder="Nouvelle idée…"
          (keydown.enter)="add(input)"
        />
        <button (click)="add(input)">+</button>
      </div>

      <ul class="inbox-list">
        @for (item of items(); track item.id) {
          <li class="inbox-item">
            <span class="item-content">{{ item.content }}</span>
            <div class="item-actions">
              <button class="promote" title="Importer dans le graph" (click)="promote(item.id)">🧠</button>
              <button class="delete" title="Supprimer" (click)="remove(item.id)">✕</button>
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
      padding: 0.75rem;
      background: #1e1e2e;
      color: #cdd6f4;
    }
    .inbox.collapsed { padding-top: 0.25rem; }

    .inbox-content {
      overflow: hidden;
      transition: max-height 320ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease;
      max-height: 1200px;
      opacity: 1;
    }
    .inbox.collapsed .inbox-content {
      max-height: 0;
      opacity: 0;
    }
    .inbox-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .inbox-header h2 { font-size: 1rem; margin: 0; }
    .inbox-actions { display: flex; gap: 0.4rem; }
    .import-btn, .export-btn {
      background: transparent;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
    }
    .inbox-input {
      display: flex;
      gap: 0.5rem;
    }
    .inbox-input input {
      flex: 1;
      padding: 0.35rem 0.6rem;
      border: 1px solid rgba(124,127,155,0.12);
      border-radius: 10px;
      background: rgba(255,255,255,0.02);
      color: #e6eef8;
      font-size: 0.95rem;
      font-weight: 400;
      outline: none;
      transition: box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    .inbox-input input::placeholder { color: #97a0bf; }
    .inbox-input input:focus {
      border-color: #89b4fa;
      box-shadow: 0 6px 18px rgba(7,10,26,0.5), 0 0 0 6px rgba(137,180,250,0.04);
      background: rgba(255,255,255,0.02);
    }
    .inbox-input button {
      padding: 0.35rem 0.6rem;
      border: none;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(137,180,250,0.14), rgba(137,180,250,0.08));
      color: #0b1020;
      font-weight: 700;
      cursor: pointer;
      min-width: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(7,10,26,0.35);
    }
    .inbox-list {
      list-style: none;
      margin: 0.75rem 0 0;
      padding: 0;
      overflow-y: auto;
      flex: 1;
    }
    .inbox-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      border-bottom: 1px solid #313244;
    }
    .item-content { flex: 1; }
    .item-actions { display: flex; gap: 0.4rem; }
    .item-actions button {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 1rem;
    }
    .promote { color: #a6e3a1; }
    .delete { color: #f38ba8; }
    .empty { color: #6c7086; padding: 1rem 0; text-align: center; }

    .import-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
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
      background: #1e1e2e;
      border-top: 1px solid #45475a;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      padding: 0.65rem 1rem calc(1rem + env(safe-area-inset-bottom));
      z-index: 901;
      box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.45);
      animation: sheet-in 180ms ease-out;
    }
    .sheet-handle {
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: #6c7086;
      margin: 0 auto 0.75rem;
    }
    .import-modal-sheet h3 {
      margin: 0 0 0.35rem;
      font-size: 1rem;
    }
    .import-modal-sheet p {
      margin: 0 0 0.75rem;
      color: #a6adc8;
      font-size: 0.85rem;
    }
    @keyframes sheet-in {
      from {
        transform: translateY(18px);
        opacity: 0.7;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.35rem 0.75rem;
      font-size: 0.85rem;
      margin-bottom: 0.9rem;
    }
    .diff-grid div:nth-child(odd) {
      color: #a6adc8;
    }
    .diff-grid div:nth-child(even) {
      color: #cdd6f4;
      font-weight: 600;
      text-align: right;
    }
    .modal-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .modal-actions button {
      border: none;
      border-radius: 8px;
      padding: 0.55rem 0.5rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .modal-actions .replace { background: #f38ba8; color: #11111b; }
    .modal-actions .merge { background: #a6e3a1; color: #11111b; }
    .modal-actions .cancel { background: #313244; color: #cdd6f4; }
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
