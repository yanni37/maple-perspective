import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InboxUiService {
  private readonly STORAGE_KEY = 'maple_inbox_collapsed';
  readonly collapsed = signal(false);

  constructor() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw !== null) this.collapsed.set(raw === '1');
    } catch (e) {}
  }

  toggle(): void {
    this.collapsed.update(v => {
      const next = !v;
      try { localStorage.setItem(this.STORAGE_KEY, next ? '1' : '0'); } catch (e) {}
      return next;
    });
  }

  set(value: boolean): void {
    try { localStorage.setItem(this.STORAGE_KEY, value ? '1' : '0'); } catch (e) {}
    this.collapsed.set(value);
  }
}
