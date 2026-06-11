import type { Action, Input } from './input';

interface Button {
  action: Action;
  label: string;
  /** Position as a fraction of viewport size (from bottom-right for the cluster). */
  cx: number;
  cy: number;
  r: number;
}

/**
 * Touch controls: floating joystick on the left half, jump/dash/grab buttons
 * on the right, pause at the top-right. Drawn on the overlay canvas in CSS px.
 */
export class TouchControls {
  private joyId: number | null = null;
  private joyOx = 0;
  private joyOy = 0;
  private joyX = 0;
  private joyY = 0;
  private buttons: Button[] = [];
  private buttonPointers = new Map<number, Action>();
  private ctx: CanvasRenderingContext2D;

  constructor(
    private input: Input,
    private overlay: HTMLCanvasElement,
  ) {
    this.ctx = overlay.getContext('2d')!;
    this.layout();
    window.addEventListener('resize', () => this.layout());

    window.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private safeInsets(): { right: number; bottom: number; left: number; top: number } {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
    return {
      right: v('--sa-right'),
      bottom: v('--sa-bottom'),
      left: v('--sa-left'),
      top: v('--sa-top'),
    };
  }

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.overlay.width = w * (window.devicePixelRatio || 1);
    this.overlay.height = h * (window.devicePixelRatio || 1);
    this.overlay.style.width = `${w}px`;
    this.overlay.style.height = `${h}px`;
    this.ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

    const inset = this.safeInsets();
    const r = Math.max(26, Math.min(w, h) * 0.065);
    const bx = w - inset.right;
    const by = h - inset.bottom;
    this.buttons = [
      { action: 'jump', label: 'A', cx: bx - r * 1.6, cy: by - r * 1.6, r },
      { action: 'dash', label: 'B', cx: bx - r * 4.0, cy: by - r * 2.6, r },
      { action: 'grab', label: 'G', cx: bx - r * 1.9, cy: by - r * 4.2, r: r * 0.85 },
      { action: 'pause', label: 'II', cx: bx - r, cy: inset.top + r, r: r * 0.6 },
    ];
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    // Buttons first (they may sit near the screen middle on small devices)
    for (const b of this.buttons) {
      const hitR = b.r * 1.35;
      if ((x - b.cx) ** 2 + (y - b.cy) ** 2 <= hitR * hitR) {
        this.buttonPointers.set(e.pointerId, b.action);
        this.input.setVirtual(b.action, true);
        return;
      }
    }
    // Left half: floating joystick
    if (x < window.innerWidth / 2 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOx = x;
      this.joyOy = y;
      this.joyX = x;
      this.joyY = y;
      this.input.touchActive = true;
      this.input.setVirtual('confirm', true); // joystick tap can also confirm menus
      this.input.setVirtual('confirm', false);
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    e.preventDefault();
    this.joyX = e.clientX;
    this.joyY = e.clientY;
    const maxR = 52;
    let dx = this.joyX - this.joyOx;
    let dy = this.joyY - this.joyOy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
      // The joystick origin follows long drags so direction changes stay responsive
      this.joyOx = this.joyX - dx;
      this.joyOy = this.joyY - dy;
    }
    const dead = 10;
    this.input.virtualAxisX = Math.abs(dx) < dead ? 0 : dx / maxR;
    this.input.virtualAxisY = Math.abs(dy) < dead ? 0 : dy / maxR;
  }

  private onUp(e: PointerEvent): void {
    const action = this.buttonPointers.get(e.pointerId);
    if (action) {
      this.buttonPointers.delete(e.pointerId);
      this.input.setVirtual(action, false);
    }
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.input.virtualAxisX = 0;
      this.input.virtualAxisY = 0;
    }
  }

  draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!this.input.touchActive) return;

    for (const b of this.buttons) {
      const held = [...this.buttonPointers.values()].includes(b.action);
      ctx.globalAlpha = held ? 0.5 : 0.22;
      ctx.fillStyle = '#cdd6ea';
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = held ? 0.9 : 0.5;
      ctx.fillStyle = '#1a2030';
      ctx.font = `bold ${Math.round(b.r * 0.7)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.cx, b.cy + 1);
    }

    if (this.joyId !== null) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#cdd6ea';
      ctx.beginPath();
      ctx.arc(this.joyOx, this.joyOy, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      const dx = this.joyX - this.joyOx;
      const dy = this.joyY - this.joyOy;
      const len = Math.hypot(dx, dy) || 1;
      const r = Math.min(len, 52);
      ctx.arc(this.joyOx + (dx / len) * r, this.joyOy + (dy / len) * r, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
