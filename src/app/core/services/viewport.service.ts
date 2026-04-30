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

  /**
   * Clamp viewport pan so the content box remains visible within the viewport element.
   * - `content` is in world coordinates (same units as node positions)
   * - `viewportSize` is in screen pixels (width/height of the canvas viewport)
   * - `padding` is extra world-space padding (in pixels) applied around content before clamping
   */
  clampToContent(content: { minX: number; minY: number; maxX: number; maxY: number } | null, viewportSize: { w: number; h: number }, padding = 120): void {
    if (!content) return;
    this._viewport.update(v => {
      const { minX, minY, maxX, maxY } = content;
      const scale = v.scale;

      // content extents in world units including padding
      const contentMinX = minX - padding;
      const contentMinY = minY - padding;
      const contentMaxX = maxX + padding;
      const contentMaxY = maxY + padding;

      const scaledMinX = contentMinX * scale;
      const scaledMinY = contentMinY * scale;
      const scaledMaxX = contentMaxX * scale;
      const scaledMaxY = contentMaxY * scale;

      const vw = viewportSize.w;
      const vh = viewportSize.h;

      // allowable pan ranges so content stays at least partially visible
      // minPanX: the minimum x (most negative) such that right edge of content >= vw
      const minPanX = Math.min(0, vw - scaledMaxX);
      // maxPanX: the maximum x such that left edge of content <= 0
      const maxPanX = Math.max(0, -scaledMinX + 0);

      const minPanY = Math.min(0, vh - scaledMaxY);
      const maxPanY = Math.max(0, -scaledMinY + 0);

      const nx = Math.max(minPanX, Math.min(maxPanX, v.x));
      const ny = Math.max(minPanY, Math.min(maxPanY, v.y));

      return { ...v, x: nx, y: ny };
    });
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
