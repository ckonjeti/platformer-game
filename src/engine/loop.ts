/** Fixed-timestep game loop: 60 logic updates per second, render once per rAF. */
export const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;

export class Loop {
  private acc = 0;
  private last = 0;
  private rafId = 0;
  running = false;

  constructor(
    private update: () => void,
    private draw: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.acc += now - this.last;
      this.last = now;
      // Clamp to avoid spiral of death after tab-out
      if (this.acc > STEP_MS * MAX_STEPS) this.acc = STEP_MS * MAX_STEPS;
      while (this.acc >= STEP_MS) {
        this.update();
        this.acc -= STEP_MS;
      }
      this.draw();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
