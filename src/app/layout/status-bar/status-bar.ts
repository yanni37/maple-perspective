import { Component, computed, inject } from '@angular/core';
import { StateService } from '../../core/services';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  template: `
    <div class="status-bar">
      <span class="status-item" [class.dirty]="isDirty()">
        @if (isDirty()) {
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5" /></svg>
        } @else {
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        }
      </span>
      <span class="status-item">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
        {{ pendingCount() }}
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
      background: var(--mp-bg-elevated, #FFF);
      color: var(--mp-text-secondary, #6B6B76);
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      border-bottom: 1px solid var(--mp-glass-border);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }
    .status-item { display: flex; align-items: center; gap: 0.25rem; }
    .icon { width: 0.85rem; height: 0.85rem; flex-shrink: 0; }
    .dirty { color: var(--mp-danger, #EA4335); }
    .last-backup { color: var(--mp-text-muted, #A0A0AB); }
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
