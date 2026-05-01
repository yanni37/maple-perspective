import { Component, inject } from '@angular/core';
import { StatusBarComponent } from '../status-bar/status-bar';
import { InboxComponent } from '../../features/inbox/inbox';
import { CanvasComponent } from '../../features/mind-map/canvas/canvas';
import { InboxUiService } from '../../core/services';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [StatusBarComponent, InboxComponent, CanvasComponent],
  template: `
    <div class="shell">
      <app-status-bar />
      <app-canvas class="canvas-area" />

      <div class="inbox-toggle" role="button" [class.collapsed]="ui.collapsed()" (click)="ui.toggle()">
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
        <div class="label">{{ ui.collapsed() ? 'Afficher Inbox' : 'Masquer Inbox' }}</div>
      </div>

      <app-inbox />
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      width: 100%;
      overflow: hidden;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }
    .canvas-area {
      flex: 1;
      background: #11111b;
    }
    app-inbox {
      max-height: 40vh;
      overflow-y: auto;
    }
    .inbox-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 3rem;
      width: 100%;
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
      color: #e6eef8;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
    }
    .inbox-toggle .chev {
      width: 1rem;
      height: 1rem;
      transform: rotate(0deg);
      transition: transform 160ms ease;
      opacity: 0.95;
    }
    .inbox-toggle.collapsed .chev {
      transform: rotate(180deg);
    }
    .inbox-toggle .label {
      font-size: 0.95rem;
      opacity: 0.95;
    }
  `],
})
export class AppShellComponent {
  readonly ui: InboxUiService = inject(InboxUiService);
}

