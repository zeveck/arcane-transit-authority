// input.js — pointer and keyboard. One path for mouse and touch: tap vs drag by 8 px and 250 ms,
// left-drag spins, right-drag tilts, wheel zooms, pinch zooms. Keys are handed to a handler as actions.
// Everything returns early while the bug-report form or the other-devices notice is open.

export class Input {
  constructor(canvas, handlers) {
    this.canvas = canvas; this.h = handlers;
    this.pointers = new Map();
    this.down = null; // { x, y, t, button, moved }
    this.keysHeld = new Set();
    this.mouse = { x: -1, y: -1, inside: false };
    this.pinch = null;
    this.bind();
  }
  blocked() { return !!window.gameReport?.isOpen?.() || !!window.otherDevices?.isOpen?.(); }

  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (this.blocked()) return;
      if (this.h.anyInput?.('pointer')) { this.down = null; return; } // the press only left a ride
      c.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        this.down = null; return;
      }
      this.down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), button: e.button, moved: false, shift: e.shiftKey };
      this.h.pointerDown?.(e.clientX, e.clientY, e.button);
    });
    c.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.blocked()) return;
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0 && this.pinch.d > 0) this.h.zoom?.(this.pinch.d / d);
        this.pinch.d = d; return;
      }
      const dn = this.down;
      if (!dn) { this.h.hover?.(e.clientX, e.clientY); return; }
      const dx = e.clientX - dn.lx, dy = e.clientY - dn.ly;
      if (!dn.moved && Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 8) { dn.moved = true; this.h.dragStart?.(dn.x, dn.y, dn.button); }
      if (dn.moved) {
        if (dn.button === 2) this.h.tilt?.(dy);
        else this.h.drag?.(dx, dy, e.clientX, e.clientY, dn.button);
      }
      dn.lx = e.clientX; dn.ly = e.clientY;
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.down = null; return; }
      if (this.blocked()) { this.down = null; return; }
      const dn = this.down; this.down = null;
      if (!dn) return;
      if (dn.moved) { this.h.dragEnd?.(e.clientX, e.clientY, dn.button); return; }
      const quick = performance.now() - dn.t < 600;
      if (dn.button === 2) { this.h.rightClick?.(e.clientX, e.clientY); return; }
      if (quick || true) this.h.tap?.(e.clientX, e.clientY, dn.button);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); this.down = null; this.pinch = null; });
    c.addEventListener('pointerleave', () => { this.mouse.inside = false; this.h.hover?.(-1, -1); });
    c.addEventListener('wheel', (e) => {
      if (this.blocked()) return;
      e.preventDefault();
      this.h.anyInput?.('wheel');
      const k = e.deltaMode === 1 ? 0.05 : 0.0015;
      this.h.zoom?.(Math.exp(e.deltaY * k));
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (this.blocked()) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.type !== 'range') return;
      // never handle Ctrl+Shift+F (the bug report shortcut)
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyF')) return;
      const used = this.h.anyInput?.('key', e.code) || this.h.key?.(e);
      if (used) e.preventDefault();
      else if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && !(t && t.tagName === 'BUTTON' && e.code === 'Space')) e.preventDefault();
      this.keysHeld.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keysHeld.delete(e.code); });
    window.addEventListener('blur', () => this.releaseAll());
  }
  releaseAll() { this.keysHeld.clear(); this.down = null; this.pointers.clear(); this.pinch = null; }
}
