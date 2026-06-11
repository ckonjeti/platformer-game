/** Unified input: keyboard + virtual touch controls feed logical actions. */
export type Action =
  | 'left' | 'right' | 'up' | 'down'
  | 'jump' | 'dash' | 'grab'
  | 'pause' | 'confirm' | 'back';

const KEY_MAP: Record<string, Action[]> = {
  ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up'], ArrowDown: ['down'],
  KeyA: ['left'], KeyD: ['right'], KeyW: ['up'], KeyS: ['down'],
  KeyZ: ['jump', 'confirm'], Space: ['jump'],
  KeyX: ['dash'], ShiftLeft: ['dash'], ShiftRight: ['dash'],
  KeyC: ['grab'], ControlLeft: ['grab'], ControlRight: ['grab'],
  Escape: ['pause', 'back'], Enter: ['confirm', 'pause'],
};

export class Input {
  /** Raw "down" state from all sources, sampled each frame. */
  private keyDown = new Set<Action>();
  private virtualDown = new Set<Action>();
  /** Joystick axis values in -1..1 (touch only). */
  virtualAxisX = 0;
  virtualAxisY = 0;

  private held = new Set<Action>();
  private prev = new Set<Action>();
  /** Fires once on any input gesture (used to unlock audio). */
  onFirstInteraction: (() => void) | null = null;
  /** True once any touch input has been seen (shows touch UI). */
  touchActive = false;

  attach(): void {
    window.addEventListener('keydown', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      e.preventDefault();
      for (const a of actions) this.keyDown.add(a);
      this.fireInteraction();
    });
    window.addEventListener('keyup', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      for (const a of actions) this.keyDown.delete(a);
    });
    window.addEventListener('blur', () => {
      this.keyDown.clear();
      this.virtualDown.clear();
    });
  }

  private fireInteraction(): void {
    if (this.onFirstInteraction) {
      const cb = this.onFirstInteraction;
      this.onFirstInteraction = null;
      cb();
    }
  }

  /** Called by the touch controller. */
  setVirtual(action: Action, down: boolean): void {
    if (down) {
      this.virtualDown.add(action);
      this.touchActive = true;
      this.fireInteraction();
    } else {
      this.virtualDown.delete(action);
    }
  }

  /** Snapshot state for this frame; call once at the top of each update. */
  update(): void {
    this.prev = new Set(this.held);
    this.held = new Set<Action>([...this.keyDown, ...this.virtualDown]);
    // Joystick axes contribute digital directions
    const t = 0.38;
    if (this.virtualAxisX < -t) this.held.add('left');
    if (this.virtualAxisX > t) this.held.add('right');
    if (this.virtualAxisY < -t) this.held.add('up');
    if (this.virtualAxisY > t) this.held.add('down');
  }

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }

  isPressed(a: Action): boolean {
    return this.held.has(a) && !this.prev.has(a);
  }

  get moveX(): -1 | 0 | 1 {
    const l = this.held.has('left'), r = this.held.has('right');
    return l === r ? 0 : l ? -1 : 1;
  }

  get moveY(): -1 | 0 | 1 {
    const u = this.held.has('up'), d = this.held.has('down');
    return u === d ? 0 : u ? -1 : 1;
  }
}
