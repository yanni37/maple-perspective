import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'maple_theme';
  readonly dark = signal(false);

  constructor() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        this.dark.set(stored === 'dark');
      } else {
        this.dark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch {}
    this.apply();
  }

  toggle(): void {
    this.dark.update(v => !v);
    this.apply();
  }

  private apply(): void {
    const theme = this.dark() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(this.STORAGE_KEY, theme); } catch {}
  }
}
