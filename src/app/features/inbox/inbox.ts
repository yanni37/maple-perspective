import { Component, computed, inject } from '@angular/core';
import { StateService, StorageService } from '../../core/services';

@Component({
  selector: 'app-inbox',
  standalone: true,
  template: `
    <div class="inbox">
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
      padding: 0.4rem 0.6rem;
      border: 1px solid #313244;
      border-radius: 6px;
      background: #11111b;
      color: #cdd6f4;
    }
    .inbox-input button {
      padding: 0.4rem 0.75rem;
      border: none;
      border-radius: 6px;
      background: #89b4fa;
      color: #11111b;
      font-weight: bold;
      cursor: pointer;
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
  `],
})
export class InboxComponent {
  private state = inject(StateService);
  private storage = inject(StorageService);

  readonly items = computed(() => this.state.inbox());

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
      // Try inbox format first, then full backup
      const count = this.storage.importInboxJSON(json);
      if (count === 0) {
        this.storage.importJSON(json);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    (event.target as HTMLInputElement).value = '';
  }

  exportBackup(): void {
    this.storage.downloadBackup();
  }
}
