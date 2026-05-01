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
  styleUrls: ['./inbox.component.scss'],
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
      this.handleImportedJSON(json);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    (event.target as HTMLInputElement).value = '';
  }

  // Public helper so parent components can forward file contents
  handleImportedJSON(json: string): void {
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
