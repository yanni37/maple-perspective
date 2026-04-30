import { Component, computed, inject, signal, NgZone, ElementRef, OnInit, OnDestroy, ChangeDetectionStrategy, effect, Injector } from '@angular/core';
import { StateService, ViewportService } from '../../../core/services';
import { NodeComponent } from '../node/node';
import { EdgesComponent } from '../edges/edges';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [NodeComponent, EdgesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas-viewport">
      <div class="canvas-world" [style.transform]="worldTransform()">
        <app-edges [focusedId]="selectedId()" />
        @for (node of visibleNodes(); track node.id) {
          <app-node
            [node]="node"
            [selected]="node.id === selectedId()"
            [dimmed]="isNodeDimmed(node.id)"
            [style.left.px]="node.position.x"
            [style.top.px]="node.position.y"
            (select)="onNodeSelect($event)"
            (dragEnd)="onDragEnd($event)"
            (longPress)="onLongPress($event)"
            (context)="onNodeContext($event)"
            (linkDrop)="onLinkDrop($event)"
            (doubleTap)="onDoubleTap($event)"
          />
        }
      </div>

      <!-- Context menu: outside canvas-world so it's not affected by transform -->
      @if (contextMenuNodeId()) {
        <div class="context-menu-overlay" (click)="closeMenu()"></div>
        <div class="context-menu" [style.left.px]="contextMenuScreenPos().x" [style.top.px]="contextMenuScreenPos().y">
          <button (click)="editNode()">✏️ Modifier</button>
          <button (click)="addChildFromMenu()">➕ Ajouter enfant</button>
          <button (click)="startLinking()">🔗 Lier</button>
          <button (click)="deleteNode()">🗑 Supprimer</button>
        </div>
      }

      <!-- Linking mode indicator -->
      @if (linkingFromId()) {
        <div class="linking-banner">
          🔗 Tap un node pour créer le lien
          <button (click)="cancelLinking()">✕</button>
        </div>
      }

      <!-- Inline edit -->
      @if (editingNodeId()) {
        <div class="edit-overlay" (click)="cancelEdit()"></div>
        <div class="edit-dialog">
          <input #editInput type="text" [value]="editingContent()" (keydown.enter)="confirmEdit(editInput.value)" />
          <button (click)="confirmEdit(editInput.value)">✓</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .canvas-viewport {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      touch-action: none;
    }
    .canvas-world {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transform-origin: 0 0;
      will-change: transform;
    }
    .context-menu-overlay {
      position: absolute;
      inset: 0;
      z-index: 99;
    }
    .context-menu {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.5rem;
      background: #1e1e2e;
      border: 1px solid #45475a;
      border-radius: 10px;
      z-index: 200;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    }
    .context-menu button {
      border: none;
      background: transparent;
      color: #cdd6f4;
      padding: 0.5rem 0.75rem;
      text-align: left;
      cursor: pointer;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .context-menu button:active { background: #313244; }
    .linking-banner {
      position: absolute;
      top: 0.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: #f9e2af;
      color: #11111b;
      padding: 0.4rem 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      z-index: 150;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .linking-banner button {
      border: none;
      background: transparent;
      font-size: 1rem;
      cursor: pointer;
    }
    .edit-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 199;
    }
    .edit-dialog {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      gap: 0.5rem;
      z-index: 300;
    }
    .edit-dialog input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #45475a;
      border-radius: 8px;
      background: #1e1e2e;
      color: #cdd6f4;
      font-size: 1rem;
      width: 200px;
    }
    .edit-dialog button {
      padding: 0.5rem 0.75rem;
      border: none;
      border-radius: 8px;
      background: #a6e3a1;
      color: #11111b;
      font-weight: bold;
      cursor: pointer;
    }
  `],
})
export class CanvasComponent implements OnInit, OnDestroy {
  private state = inject(StateService);
  private viewportSvc = inject(ViewportService);
  private injector = inject(Injector);
  private zone = inject(NgZone);
  private elRef = inject(ElementRef<HTMLElement>);

  readonly worldTransform = this.viewportSvc.transform;
  readonly selectedId = signal<string | null>(null);
  readonly contextMenuNodeId = signal<string | null>(null);
  readonly contextMenuPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly linkingFromId = signal<string | null>(null);
  readonly editingNodeId = signal<string | null>(null);
  readonly editingContent = signal('');

  // Context menu position in screen coords (not affected by world transform)
  readonly contextMenuScreenPos = computed(() => {
    const pos = this.contextMenuPos();
    const vp = this.viewportSvc.viewport();
    return {
      x: pos.x * vp.scale + vp.x,
      y: pos.y * vp.scale + vp.y,
    };
  });

  readonly visibleNodes = computed(() => {
    const nodes = this.state.nodes();
    return nodes;
  });

  readonly connectedIds = computed<Set<string>>(() => {
    const id = this.selectedId();
    if (!id) return new Set();
    const edges = this.state.edges();
    const ids = new Set<string>([id]);
    for (const e of edges) {
      if (e.sourceId === id || e.targetId === id) {
        ids.add(e.sourceId);
        ids.add(e.targetId);
      }
    }
    return ids;
  });

  isNodeDimmed(nodeId: string): boolean {
    const sel = this.selectedId();
    if (!sel) return false;
    return !this.connectedIds().has(nodeId);
  }

  // ─── Pan state ─────────────────────────────────────────────────────
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private rafId: number | null = null;

  // Inertia (momentum) state
  private pointerHistories = new Map<number, Array<{ x: number; y: number; t: number }>>();
  private inertiaVx = 0; // pixels per ms
  private inertiaVy = 0; // pixels per ms
  private inertiaRaf: number | null = null;
  private lastInertiaTs = 0;

  // ─── Pinch state ───────────────────────────────────────────────────
  private initialPinchDist = 0;
  private initialScale = 1;

  // ─── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    const el = this.elRef.nativeElement;
    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointermove', this.onPointerMove);
      el.addEventListener('pointerup', this.onPointerUp);
      el.addEventListener('pointercancel', this.onPointerUp);
      el.addEventListener('wheel', this.onWheel, { passive: false });
      el.addEventListener('touchstart', this.onTouchStart, { passive: false });
      el.addEventListener('touchmove', this.onTouchMove, { passive: false });
      el.addEventListener('touchend', this.onTouchEnd);
    });

    // Center viewport on the first root (parent-less) node when nodes are restored.
    let didCenter = false;
    effect(() => {
      const nodes = this.state.nodes();
      if (didCenter) return;
      if (!nodes || nodes.length === 0) return;

      // find first parent/root node (node without parentId)
      const root = nodes.find(n => !n.parentId) || nodes[0];
      if (!root) return;

      // Determine viewport element size
      let vw = window.innerWidth;
      let vh = window.innerHeight;
      try {
        const viewportEl = this.elRef.nativeElement.querySelector('.canvas-viewport') as HTMLElement | null;
        if (viewportEl) {
          const r = viewportEl.getBoundingClientRect();
          vw = r.width || vw;
          vh = r.height || vh;
        }
      } catch (e) {}

      // node center (node.position is top-left)
      const NODE_W = 160;
      const NODE_H = 48;
      const cx = root.position.x + NODE_W / 2;
      const cy = root.position.y + NODE_H / 2;

      this.viewportSvc.centerOn(cx, cy, vw, vh);
      didCenter = true;
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    const el = this.elRef.nativeElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  // ─── Pointer (pan) ────────────────────────────────────────────────
  private activePointers = new Map<number, PointerEvent>();

  private onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('canvas-viewport') && !target.classList.contains('canvas-world')) return;

    // Clicking on the empty canvas should clear selection so everything returns to full color
    this.selectedId.set(null);

    // stop any running inertia when the user interacts
    this.stopInertia();

    this.activePointers.set(e.pointerId, e);
    // start history for this pointer
    this.pointerHistories.set(e.pointerId, [{ x: e.clientX, y: e.clientY, t: performance.now() }]);
    if (this.activePointers.size === 1) {
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, e);
    // record pointer history (for velocity calc)
    const hist = this.pointerHistories.get(e.pointerId) ?? [];
    hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    // keep last 8 samples
    if (hist.length > 8) hist.shift();
    this.pointerHistories.set(e.pointerId, hist);
    if (this.isPanning && this.activePointers.size === 1) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.scheduleUpdate(() => {
        this.viewportSvc.pan(dx, dy);
        this.applyClamp();
      });
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    // compute velocity for this pointer and start inertia if appropriate
    const hist = this.pointerHistories.get(e.pointerId) ?? [];
    this.pointerHistories.delete(e.pointerId);

    // simple velocity: use last sample vs sample 3 entries back if available
    if (hist.length >= 2) {
      const last = hist[hist.length - 1];
      // find a sample ~50-120ms before last
      let ref = hist[0];
      for (let i = hist.length - 2; i >= 0; i--) {
        if (last.t - hist[i].t > 50) { ref = hist[i]; break; }
      }
      const dt = Math.max(1, last.t - ref.t); // ms
      const vx = (last.x - ref.x) / dt; // px per ms
      const vy = (last.y - ref.y) / dt;

      const speed = Math.hypot(vx, vy);
      // threshold px/ms -> ~0.03 px/ms = 30 px/s (lower to start inertia for gentler swipes)
      const START_THRESHOLD = 0.03; // px/ms
      if (speed > START_THRESHOLD) {
        this.inertiaVx = vx;
        this.inertiaVy = vy;
        this.startInertia();
      }
    }

    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.isPanning = false;
    }
  };

  private startInertia(): void {
    if (this.inertiaRaf) return;
    this.lastInertiaTs = performance.now();
    const step = (t: number) => {
      const dt = t - this.lastInertiaTs; // ms
      this.lastInertiaTs = t;
      // apply movement
      const dx = this.inertiaVx * dt;
      const dy = this.inertiaVy * dt;
      this.viewportSvc.pan(dx, dy);
      this.applyClamp();
      // apply friction (adjusted for smoother, iOS-like glide)
      // per-frame multiplier: closer to 1 => longer glide
      const FRICTION = 0.985; // tuned for softer deceleration
      this.inertiaVx *= FRICTION;
      this.inertiaVy *= FRICTION;
      const speed = Math.hypot(this.inertiaVx, this.inertiaVy);
      // stop when the velocity is very small (px/ms)
      const STOP_THRESHOLD = 0.01; // ~10 px/s
      if (speed < STOP_THRESHOLD) {
        this.stopInertia();
        return;
      }
      this.inertiaRaf = requestAnimationFrame(step);
    };
    this.inertiaRaf = requestAnimationFrame(step);
  }

  private stopInertia(): void {
    if (this.inertiaRaf) {
      cancelAnimationFrame(this.inertiaRaf);
      this.inertiaRaf = null;
    }
    this.inertiaVx = 0;
    this.inertiaVy = 0;
  }

  // ─── Wheel zoom ───────────────────────────────────────────────────
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const vp = this.viewportSvc.viewport();
    const delta = -e.deltaY * 0.001;
    const newScale = vp.scale * (1 + delta);
    this.scheduleUpdate(() => {
      this.viewportSvc.zoom(newScale, e.clientX, e.clientY);
      this.applyClamp();
    });
  };

  // ─── Pinch zoom ───────────────────────────────────────────────────
  private touches: Touch[] = [];

  private onTouchStart = (e: TouchEvent): void => {
    // stop any pinch inertia when starting new touch
    this.stopPinchInertia();
    // if single-finger touch on background, clear selection so all nodes show
    const t = e.target as HTMLElement | null;
    if (e.touches.length === 1 && t && (t.classList.contains('canvas-viewport') || t.classList.contains('canvas-world'))) {
      this.selectedId.set(null);
    }
    if (e.touches.length === 2) {
      e.preventDefault();
      this.touches = [e.touches[0], e.touches[1]];
      this.initialPinchDist = this.getTouchDist(this.touches[0], this.touches[1]);
      this.initialScale = this.viewportSvc.viewport().scale;
      // init pinch history
      this.pinchHistory = [{ scale: this.initialScale, t: performance.now(), midX: (this.touches[0].clientX + this.touches[1].clientX)/2, midY: (this.touches[0].clientY + this.touches[1].clientY)/2 }];
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = this.getTouchDist(e.touches[0], e.touches[1]);
      const newScale = this.initialScale * (dist / this.initialPinchDist);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      // record pinch sample
      const now = performance.now();
      this.pinchHistory = this.pinchHistory ?? [];
      this.pinchHistory.push({ scale: newScale, t: now, midX, midY });
      if (this.pinchHistory.length > 8) this.pinchHistory.shift();

      this.scheduleUpdate(() => {
        this.viewportSvc.zoom(newScale, midX, midY);
        this.applyClamp();
      });
    }
  };

  private onTouchEnd = (): void => {
    // compute pinch velocity and start pinch inertia if applicable
    if (this.pinchHistory && this.pinchHistory.length >= 2) {
      const last = this.pinchHistory[this.pinchHistory.length - 1];
      let ref = this.pinchHistory[0];
      for (let i = this.pinchHistory.length - 2; i >= 0; i--) {
        if (last.t - this.pinchHistory[i].t > 50) { ref = this.pinchHistory[i]; break; }
      }
      const dt = Math.max(1, last.t - ref.t);
      const v = (last.scale - ref.scale) / dt; // scale per ms
      const speed = Math.abs(v);
      const PINCH_START = 0.0005; // start if scale changes ~0.0005 per ms
      if (speed > PINCH_START) {
        this.pinchInertiaV = v;
        this.pinchInertiaMid = { x: last.midX, y: last.midY };
        this.startPinchInertia();
      }
    }
    this.touches = [];
    this.pinchHistory = undefined;
  };

  // ─── Pinch inertia state ─────────────────────────────────────────
  private pinchHistory: Array<{ scale: number; t: number; midX: number; midY: number }> | undefined;
  private pinchInertiaV = 0; // scale per ms
  private pinchInertiaRaf: number | null = null;
  private pinchInertiaMid: { x: number; y: number } | null = null;

  private startPinchInertia(): void {
    if (this.pinchInertiaRaf) return;
    let lastTs = performance.now();
    const step = (t: number) => {
      const dt = t - lastTs; lastTs = t;
      const vp = this.viewportSvc.viewport();
      // apply additive scale change (small dt approximation)
      const newScale = vp.scale + this.pinchInertiaV * dt;
      const mid = this.pinchInertiaMid ?? { x: 0, y: 0 };
      this.viewportSvc.zoom(newScale, mid.x, mid.y);
      this.applyClamp();
      // friction
      const F = 0.92;
      this.pinchInertiaV *= F;
      if (Math.abs(this.pinchInertiaV) < 0.0002) {
        this.stopPinchInertia();
        return;
      }
      this.pinchInertiaRaf = requestAnimationFrame(step);
    };
    this.pinchInertiaRaf = requestAnimationFrame(step);
  }

  private stopPinchInertia(): void {
    if (this.pinchInertiaRaf) {
      cancelAnimationFrame(this.pinchInertiaRaf);
      this.pinchInertiaRaf = null;
    }
    this.pinchInertiaV = 0;
    this.pinchInertiaMid = null;
  }

  // ─── RAF batching ─────────────────────────────────────────────────
  private pendingUpdate: (() => void) | null = null;

  private scheduleUpdate(fn: () => void): void {
    this.pendingUpdate = fn;
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingUpdate) {
          this.pendingUpdate();
          this.pendingUpdate = null;
        }
      });
    }
  }

  private getTouchDist(a: Touch, b: Touch): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  // ─── Node interaction callbacks ───────────────────────────────────
  onNodeSelect(nodeId: string): void {
    const linkFrom = this.linkingFromId();
    if (linkFrom) {
      // We're in linking mode: create the link
      if (linkFrom !== nodeId) {
        this.state.linkNodes(linkFrom, nodeId);
      }
      this.linkingFromId.set(null);
    } else {
      this.selectedId.set(nodeId);
    }
  }

  onDragEnd(event: { id: string; x: number; y: number }): void {
    this.state.updateNodePosition(event.id, { x: event.x, y: event.y });
  }

  onLongPress(nodeId: string): void {
    const node = this.state.nodes().find(n => n.id === nodeId);
    if (node) {
      this.contextMenuNodeId.set(nodeId);
      this.contextMenuPos.set({ x: node.position.x + 40, y: node.position.y + 40 });
    }
  }

  onNodeContext(evt: { id: string; x: number; y: number }): void {
    // convert screen coords to world coords and open menu there
    const world = this.viewportSvc.screenToWorld(evt.x, evt.y);
    this.contextMenuNodeId.set(evt.id);
    this.contextMenuPos.set({ x: world.x, y: world.y });
  }

  // Ensure viewport stays within content bounds computed from nodes
  private applyClamp(padding = 120): void {
    const nodes = this.state.nodes();
    if (!nodes || nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 160); // assume node width ~160px to include text
      maxY = Math.max(maxY, n.position.y + 48);  // assume node height ~48px
    }

    const vpEl = this.elRef.nativeElement.querySelector('.canvas-viewport') as HTMLElement | null;
    if (!vpEl) return;
    const rect = vpEl.getBoundingClientRect();
    this.viewportSvc.clampToContent({ minX, minY, maxX, maxY }, { w: rect.width, h: rect.height }, padding);
  }

  onLinkDrop(event: { sourceId: string; targetId: string }): void {
    if (event.sourceId !== event.targetId) {
      this.state.linkNodes(event.sourceId, event.targetId);
    }
  }

  onDoubleTap(nodeId: string): void {
    const parent = this.state.nodes().find(n => n.id === nodeId);
    if (parent) {
      const childPos = { x: parent.position.x + 120, y: parent.position.y + 60 };
      const child = this.state.addChild(nodeId, 'Nouvelle idée', childPos);
      this.selectedId.set(child.id);
      // Immediately open edit for the new child
      this.editingNodeId.set(child.id);
      this.editingContent.set(child.content);
    }
  }

  // ─── Context menu actions ─────────────────────────────────────────
  editNode(): void {
    const nodeId = this.contextMenuNodeId();
    if (nodeId) {
      const node = this.state.nodes().find(n => n.id === nodeId);
      if (node) {
        this.editingNodeId.set(nodeId);
        this.editingContent.set(node.content);
      }
    }
    this.closeMenu();
  }

  addChildFromMenu(): void {
    const parentId = this.contextMenuNodeId();
    if (parentId) {
      this.onDoubleTap(parentId);
    }
    this.closeMenu();
  }

  startLinking(): void {
    const nodeId = this.contextMenuNodeId();
    this.linkingFromId.set(nodeId);
    this.closeMenu();
  }

  cancelLinking(): void {
    this.linkingFromId.set(null);
  }

  deleteNode(): void {
    const nodeId = this.contextMenuNodeId();
    if (nodeId) {
      this.state.removeNode(nodeId);
      if (this.selectedId() === nodeId) this.selectedId.set(null);
    }
    this.closeMenu();
  }

  closeMenu(): void {
    this.contextMenuNodeId.set(null);
  }

  // ─── Edit dialog ──────────────────────────────────────────────────
  confirmEdit(value: string): void {
    const nodeId = this.editingNodeId();
    if (nodeId && value.trim()) {
      this.state.updateNodeContent(nodeId, value.trim());
    }
    this.editingNodeId.set(null);
  }

  cancelEdit(): void {
    this.editingNodeId.set(null);
  }
}
