import { Component } from '@angular/core';
import { StatusBarComponent } from '../status-bar/status-bar';
import { InboxComponent } from '../../features/inbox/inbox';
import { CanvasComponent } from '../../features/mind-map/canvas/canvas';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [StatusBarComponent, InboxComponent, CanvasComponent],
  template: `
    <div class="shell">
      <app-status-bar />
      <app-canvas class="canvas-area" />
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
  `],
})
export class AppShellComponent {}
