import { Component, inject } from '@angular/core';
import { StatusBarComponent } from '../status-bar/status-bar';
import { InboxComponent } from '../../features/inbox/inbox';
import { CanvasComponent } from '../../features/mind-map/canvas/canvas';
import { InboxUiService, ThemeService, StorageService } from '../../core/services';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [StatusBarComponent, InboxComponent, CanvasComponent],
  template: `
    <div class="shell">
      <app-status-bar />
      <app-canvas class="canvas-area" />

      <button
        type="button"
        class="inbox-toggle"
        [class.collapsed]="ui.collapsed()"
        [attr.aria-expanded]="!ui.collapsed()"
        aria-controls="inbox-panel"
        (click)="ui.toggle()"
      >
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
        <span class="label">{{ ui.collapsed() ? 'Afficher Inbox' : 'Masquer Inbox' }}</span>
        <span
          class="action-btn action-left-2"
          role="button"
          tabindex="0"
          title="Importer JSON"
          (click)="$event.stopPropagation(); fileInput.click()"
          (keydown.enter)="$event.stopPropagation(); fileInput.click()"
        ><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" /></svg></span>
        <span
          class="action-btn action-left-1"
          role="button"
          tabindex="0"
          title="Exporter backup"
          (click)="$event.stopPropagation(); exportBackup()"
          (keydown.enter)="$event.stopPropagation(); exportBackup()"
        ><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg></span>
        <span
          class="theme-btn"
          role="button"
          tabindex="0"
          [attr.aria-label]="theme.dark() ? 'Mode jour' : 'Mode nuit'"
          (click)="$event.stopPropagation(); theme.toggle()"
          (keydown.enter)="$event.stopPropagation(); theme.toggle()"
          (keydown.space)="$event.stopPropagation(); theme.toggle()"
        >@if (theme.dark()) {
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
        } @else {
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
        }</span>
      </button>

      <aside
        id="inbox-panel"
        class="inbox-panel"
        [class.collapsed]="ui.collapsed()"
        [attr.aria-hidden]="ui.collapsed()"
      >
        <app-inbox />
      </aside>
      <input #fileInput type="file" accept=".json" hidden (change)="importFile($event)" />
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      width: 100%;
      overflow: hidden;
      background: var(--mp-bg-base);
      position: relative;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }

    .canvas-area {
      flex: 1;
      background: linear-gradient(
        168deg,
        var(--mp-bg-canvas-from, #EDECE8),
        var(--mp-bg-canvas-to,   #E4E2DC)
      );
    }

    .inbox-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--mp-space-sm);
      min-height: var(--mp-hit-target, 44px);
      width: 100%;
      border: none;
      border-top: 1px solid var(--mp-glass-border);
      background: var(--mp-bg-surface);
      -webkit-backdrop-filter: blur(var(--mp-glass-blur));
      backdrop-filter: blur(var(--mp-glass-blur));
      color: var(--mp-text-secondary);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      padding: 0;
      font: inherit;
      position: relative;
      transition: background var(--mp-transition-fast), color var(--mp-transition-fast);
    }

    @supports not (backdrop-filter: blur(1px)) {
      .inbox-toggle { background: var(--mp-bg-surface-solid); }
    }

    .inbox-toggle:hover  { background: var(--mp-bg-hover); }
    .inbox-toggle:active { background: var(--mp-bg-active); }

    .inbox-toggle:focus-visible {
      outline: 2px solid var(--mp-accent);
      outline-offset: -2px;
      box-shadow: 0 0 0 4px var(--mp-accent-glow);
    }

    .inbox-toggle .chev {
      width: 0.9rem;
      height: 0.9rem;
      transform: rotate(0deg);
      transition: transform var(--mp-transition-fast);
      opacity: 0.5;
    }
    .inbox-toggle.collapsed .chev { transform: rotate(180deg); }

    .inbox-toggle .label {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .theme-btn {
      position: absolute;
      right: var(--mp-space-md);
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      border-radius: 50%;
      border: 1px solid var(--mp-glass-border);
      background: var(--mp-bg-elevated);
      box-shadow: var(--mp-glass-shadow);
      margin-top: -18px;
      transition: transform var(--mp-transition-fast), box-shadow var(--mp-transition-fast);
      -webkit-tap-highlight-color: transparent;
      z-index: 2;
    }
    .theme-btn:hover { box-shadow: var(--mp-glass-shadow-lg); }
    .theme-btn:active { transform: translateY(-50%) scale(0.88); }
    .theme-btn:focus-visible {
      outline: 2px solid var(--mp-accent);
      outline-offset: 1px;
    }

    .action-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      border-radius: 50%;
      border: 1px solid var(--mp-glass-border);
      background: var(--mp-bg-elevated);
      box-shadow: var(--mp-glass-shadow);
      margin-top: -18px;
      transition: transform var(--mp-transition-fast), box-shadow var(--mp-transition-fast);
      -webkit-tap-highlight-color: transparent;
      z-index: 2;
    }
    .action-btn:hover { box-shadow: var(--mp-glass-shadow-lg); }
    .action-btn:active { transform: translateY(-50%) scale(0.88); }
    .action-btn:focus-visible {
      outline: 2px solid var(--mp-accent);
      outline-offset: 1px;
    }
    .action-left-1 { left: var(--mp-space-md); }
    .action-left-2 { left: calc(var(--mp-space-md) + 44px); }

    .action-btn .icon, .theme-btn .icon {
      width: 1.1rem;
      height: 1.1rem;
    }

    .inbox-panel {
      max-height: 40vh;
      overflow-y: auto;
      background: var(--mp-bg-surface);
      -webkit-backdrop-filter: blur(var(--mp-glass-blur));
      backdrop-filter: blur(var(--mp-glass-blur));
      border-top: 1px solid var(--mp-glass-border);
      box-shadow: var(--mp-glass-shadow);
      transition:
        max-height var(--mp-transition-slow),
        opacity    var(--mp-transition-normal),
        transform  var(--mp-transition-normal);
      transform: translateY(0);
      opacity: 1;
    }

    @supports not (backdrop-filter: blur(1px)) {
      .inbox-panel { background: var(--mp-bg-surface-solid); }
    }

    .inbox-panel.collapsed {
      max-height: 0;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      overflow: hidden;
    }

    @media (prefers-reduced-motion: reduce) {
      .inbox-toggle .chev,
      .inbox-panel { transition: none; }
    }
  `],
})
export class AppShellComponent {
  readonly ui: InboxUiService = inject(InboxUiService);
  readonly theme: ThemeService = inject(ThemeService);
  private storage: StorageService = inject(StorageService);

  exportBackup(): void {
    this.storage.downloadBackup();
  }

  importFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      const count = this.storage.importInboxJSON(json);
      if (count === 0) {
        const ok = this.storage.mergeJSON(json);
        if (!ok) window.alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }
}

