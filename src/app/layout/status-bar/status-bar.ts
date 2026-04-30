import { Component, computed, inject } from '@angular/core';
import { StateService } from '../../core/services';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  template: `
    <div class="status-bar">
      <span class="status-item" [class.dirty]="isDirty()">
        {{ isDirty() ? '●' : '✓' }}
      </span>
      <span class="status-item">
        📥 {{ pendingCount() }}
      </span>
      <span class="status-item last-backup">
        {{ lastBackupLabel() }}
      </span>
    </div>
  `,
  styles: [`
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.4rem 0.75rem;
      background: #1e1e2e;
      color: #cdd6f4;
      font-size: 0.75rem;
      border-bottom: 1px solid #313244;
    }
    .status-item { display: flex; align-items: center; gap: 0.25rem; }
    .dirty { color: #f38ba8; }
    .last-backup { color: #a6adc8; }
  `],
})
export class StatusBarComponent {
  private state = inject(StateService);

  readonly isDirty = computed(() => this.state.meta().dirty);
  readonly pendingCount = computed(() => this.state.meta().pendingCount);
  readonly lastBackupLabel = computed(() => {
    const date = this.state.meta().lastBackupAt;
    return date ? new Date(date).toLocaleTimeString() : 'jamais';
  });
}
