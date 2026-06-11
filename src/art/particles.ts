import { rand, rng } from '../engine/rng';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import type { ChapterPalette } from './palettes';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

const POOL_SIZE = 300;

export class Particles {
  private pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', gravity: 0,
  }));

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, gravity = 0): void {
    const p = this.pool.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.gravity = gravity;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  update(): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      if (--p.life <= 0) p.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.5);
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (p.life / p.maxLife)));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------- emitter helpers

  dust(x: number, y: number, color: string, count = 3): void {
    for (let i = 0; i < count; i++) {
      this.spawn(x + rand(-3, 3), y + rand(-1, 1), rand(-0.4, 0.4), rand(-0.5, -0.1), 14 + rand(0, 8), 1, color);
    }
  }

  deathBurst(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.spawn(x, y, Math.cos(a) * 1.6, Math.sin(a) * 1.6, 22, 2, color);
      this.spawn(x, y, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 30, 1, '#ffffff');
    }
  }

  sparkle(x: number, y: number, color: string): void {
    for (let i = 0; i < 10; i++) {
      this.spawn(x + rand(-2, 2), y + rand(-2, 2), rand(-0.7, 0.7), rand(-1.2, -0.2), 24, 1, i % 3 === 0 ? '#ffffff' : color);
    }
  }

  springBounce(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      this.spawn(x + rand(-4, 4), y, rand(-0.5, 0.5), rand(-1.4, -0.6), 16, 1, color);
    }
  }
}

/** Two drifting translucent fog bands; alpha follows the chapter palette (the fog literally lifts). */
export class Fog {
  private t = 0;
  private noise: HTMLCanvasElement;

  constructor(private pal: ChapterPalette) {
    this.noise = document.createElement('canvas');
    this.noise.width = VIEW_W;
    this.noise.height = 64;
    const ctx = this.noise.getContext('2d')!;
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = pal.fogColor;
      ctx.globalAlpha = 0.10 + rng() * 0.22;
      const w = 10 + rng() * 42;
      ctx.fillRect(rng() * VIEW_W, rng() * 64, w, 3 + rng() * 7);
    }
    ctx.globalAlpha = 1;
  }

  update(): void {
    this.t++;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.pal.fogAlpha <= 0) return;
    const drift1 = (this.t * 0.15) % VIEW_W;
    const drift2 = (this.t * 0.08) % VIEW_W;
    const bob1 = Math.sin(this.t * 0.008) * 6;
    const bob2 = Math.cos(this.t * 0.005) * 8;
    ctx.globalAlpha = this.pal.fogAlpha;
    ctx.drawImage(this.noise, drift1 - VIEW_W, 96 + bob1);
    ctx.drawImage(this.noise, drift1, 96 + bob1);
    ctx.globalAlpha = this.pal.fogAlpha * 0.7;
    ctx.drawImage(this.noise, drift2 - VIEW_W, 30 + bob2);
    ctx.drawImage(this.noise, drift2, 30 + bob2);
    ctx.globalAlpha = 1;
  }
}

/** Ambient floating light motes; density rises through the chapters. */
export class AmbientMotes {
  private motes: { x: number; y: number; phase: number; speed: number }[] = [];

  constructor(private pal: ChapterPalette) {
    for (let i = 0; i < pal.ambientMotes; i++) {
      this.motes.push({ x: rng() * VIEW_W, y: rng() * VIEW_H, phase: rng() * Math.PI * 2, speed: 0.05 + rng() * 0.12 });
    }
  }

  update(): void {
    for (const m of this.motes) {
      m.y -= m.speed;
      m.phase += 0.02;
      m.x += Math.sin(m.phase) * 0.15;
      if (m.y < -2) {
        m.y = VIEW_H + 2;
        m.x = rng() * VIEW_W;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.pal.accent;
    for (const m of this.motes) {
      ctx.globalAlpha = 0.3 + Math.sin(m.phase * 2) * 0.2;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
