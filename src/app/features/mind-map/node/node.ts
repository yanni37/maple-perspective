import { Component, Input, Output, EventEmitter, ElementRef, inject, NgZone } from '@angular/core';
import type { MindMapNode } from '../../../core/models';

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 5;

@Component({
  selector: 'app-node',
  standalone: true,
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(touchstart)': 'onPointerDown($event)',
    '(contextmenu)': 'onContextMenu($event)',
    '[style.position]': '"absolute"',
  },
  template: `
    <div class="node" [class.selected]="selected" [class.dragging]="dragging" [class.dimmed]="dimmed">
      {{ node.content }}
    </div>
  `,
  styles: [`
    :host { touch-action: none; z-index: 1; transition: opacity 0.2s; }
    :host(.is-dragging) { z-index: 100; }
    .node {
      padding: 0.5rem 0.85rem;
      background: var(--mp-bg-elevated, #FFF);
      color: var(--mp-text-primary, #1A1A1E);
      border: 1.5px solid var(--mp-glass-border);
      border-radius: var(--mp-radius-sm, 10px);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: grab;
      user-select: none;
      white-space: nowrap;
      box-shadow: var(--mp-glass-shadow);
      transition: border-color 0.15s, box-shadow 0.15s, opacity 0.2s, transform 0.15s;
    }
    .node.selected {
      border-color: var(--mp-accent, #5B6EF5);
      box-shadow: 0 0 0 3px var(--mp-accent-glow), var(--mp-glass-shadow);
    }
    .node.dragging {
      cursor: grabbing;
      opacity: 0.9;
      transform: scale(1.04);
      box-shadow: var(--mp-glass-shadow-lg);
    }
    .node.dimmed {
      opacity: 0.18;
    }
  `],
})
export class NodeComponent {
  @Input({ required: true }) node!: MindMapNode;
  @Input() selected = false;
  @Input() dimmed = false;
  @Output() select = new EventEmitter<string>();
  @Output() dragEnd = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() longPress = new EventEmitter<string>();
  @Output() context = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() linkDrop = new EventEmitter<{ sourceId: string; targetId: string }>();
  @Output() doubleTap = new EventEmitter<string>();

  dragging = false;

  private elRef = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private startX = 0;
  private startY = 0;
  private nodeStartX = 0;
  private nodeStartY = 0;
  private moved = false;
  private currentDx = 0;
  private currentDy = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private lastTapTime = 0;

  private moveListener = (e: MouseEvent | TouchEvent) => this.onPointerMove(e);
  private upListener = (e: MouseEvent | TouchEvent) => this.onPointerUp(e);

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const x = event.clientX;
    const y = event.clientY;
    this.zone.run(() => {
      this.context.emit({ id: this.node.id, x, y });
      // Also keep existing longPress semantic for menu
      this.longPress.emit(this.node.id);
    });
  }

  onPointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const pos = this.getClientPos(event);
    this.startX = pos.x;
    this.startY = pos.y;
    this.nodeStartX = this.node.position.x;
    this.nodeStartY = this.node.position.y;
    this.moved = false;
    this.dragging = false;
    this.currentDx = 0;
    this.currentDy = 0;

    // Long press detection
    this.longPressTimer = setTimeout(() => {
      if (!this.moved) {
        this.zone.run(() => this.longPress.emit(this.node.id));
      }
    }, LONG_PRESS_MS);

    this.zone.runOutsideAngular(() => {
      // Support pointer events when available
      if (window.PointerEvent) {
        document.addEventListener('pointermove', this.moveListener as any);
        document.addEventListener('pointerup', this.upListener as any);
      } else {
        document.addEventListener('mousemove', this.moveListener);
        document.addEventListener('mouseup', this.upListener);
        document.addEventListener('touchmove', this.moveListener, { passive: false });
        document.addEventListener('touchend', this.upListener);
      }
    });
  }

  private onPointerMove(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    const pos = this.getClientPos(event);
    const dx = pos.x - this.startX;
    const dy = pos.y - this.startY;

    if (!this.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this.moved = true;
      this.dragging = true;
      this.elRef.nativeElement.classList.add('is-dragging');
      this.clearLongPress();
    }

    if (this.moved) {
      this.currentDx = dx;
      this.currentDy = dy;
      // Use RAF for smooth visual update without triggering Angular CD
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          const el = this.elRef.nativeElement;
          el.style.left = `${this.nodeStartX + this.currentDx}px`;
          el.style.top = `${this.nodeStartY + this.currentDy}px`;
        });
      }
    }
  }

  private onPointerUp(event: MouseEvent | TouchEvent): void {
    this.clearLongPress();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (window.PointerEvent) {
      document.removeEventListener('pointermove', this.moveListener as any);
      document.removeEventListener('pointerup', this.upListener as any);
    } else {
      document.removeEventListener('mousemove', this.moveListener);
      document.removeEventListener('mouseup', this.upListener);
      document.removeEventListener('touchmove', this.moveListener);
      document.removeEventListener('touchend', this.upListener);
    }

    this.elRef.nativeElement.classList.remove('is-dragging');

    this.zone.run(() => {
      if (this.moved) {
        this.dragging = false;
        this.dragEnd.emit({
          id: this.node.id,
          x: this.nodeStartX + this.currentDx,
          y: this.nodeStartY + this.currentDy,
        });
      } else {
        // Double tap detection
        const now = Date.now();
        if (now - this.lastTapTime < 300) {
          this.doubleTap.emit(this.node.id);
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
          this.select.emit(this.node.id);
        }
      }
    });
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private getClientPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }
}
