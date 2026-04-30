import { Injectable, signal, computed } from '@angular/core';

export interface Viewport {
  x: number;      // pan offset X (world coords)
  y: number;      // pan offset Y
  scale: number;  // zoom level (1 = 100%)
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

/**
 * Manages camera/viewport state independently of data.
 * Separates rendering logic from domain data (StateService).
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly _viewport = signal<Viewport>({ x: 0, y: 0, scale: 1 });

  readonly viewport = this._viewport.asReadonly();
  readonly transform = computed(() => {
    const { x, y, scale } = this._viewport();
    return `translate(${x}px, ${y}px) scale(${scale})`;
  });

  pan(dx: number, dy: number): void {
    this._viewport.update(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }

  zoom(newScale: number, focalX: number, focalY: number): void {
    this._viewport.update(v => {
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      const ratio = clamped / v.scale;
      // Zoom toward focal point: adjust pan so focal stays fixed
      return {
        scale: clamped,
        x: focalX - ratio * (focalX - v.x),
        y: focalY - ratio * (focalY - v.y),
      };
    });
  }

  reset(): void {
    this._viewport.set({ x: 0, y: 0, scale: 1 });
  }

  /** Convert screen coords to world coords (for placing nodes). */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const { x, y, scale } = this._viewport();
    return {
      x: (screenX - x) / scale,
      y: (screenY - y) / scale,
    };
  }
}
