import { makeRng } from '../engine/rng';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import type { ChapterPalette } from './palettes';

export interface BackgroundArt {
  sky: HTMLCanvasElement;
  far: HTMLCanvasElement;
  near: HTMLCanvasElement;
  rays: HTMLCanvasElement | null;
}

function ridgeLayer(color: string, seed: number, base: number, amp: number): HTMLCanvasElement {
  const w = 480;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = VIEW_H;
  const ctx = c.getContext('2d')!;
  const rnd = makeRng(seed);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  const p3 = rnd() * Math.PI * 2;
  ctx.fillStyle = color;
  for (let x = 0; x < w; x++) {
    // Periodic in w so the layer tiles seamlessly
    const t = (x / w) * Math.PI * 2;
    const h =
      base +
      Math.sin(t * 3 + p1) * amp +
      Math.sin(t * 7 + p2) * amp * 0.4 +
      Math.sin(t * 13 + p3) * amp * 0.2;
    const top = Math.floor(h);
    ctx.fillRect(x, top, 1, VIEW_H - top);
  }
  return c;
}

export function buildBackground(pal: ChapterPalette): BackgroundArt {
  // Sky: banded vertical gradient for a retro feel
  const sky = document.createElement('canvas');
  sky.width = VIEW_W;
  sky.height = VIEW_H;
  const sctx = sky.getContext('2d')!;
  const bands = 18;
  const top = hexToRgb(pal.bgTop);
  const bottom = hexToRgb(pal.bgBottom);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    sctx.fillStyle = rgbToHex(
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t),
    );
    sctx.fillRect(0, Math.floor((i * VIEW_H) / bands), VIEW_W, Math.ceil(VIEW_H / bands) + 1);
  }
  if (pal.stars) {
    const rnd = makeRng(pal.id * 31337);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rnd() * VIEW_W);
      const y = Math.floor(rnd() * VIEW_H * 0.7);
      sctx.fillStyle = rnd() > 0.8 ? '#ffffff' : pal.accent;
      sctx.globalAlpha = 0.3 + rnd() * 0.5;
      sctx.fillRect(x, y, 1, 1);
    }
    sctx.globalAlpha = 1;
  }

  const far = ridgeLayer(pal.ridgeFar, pal.id * 101 + 1, 95, 22);
  const near = ridgeLayer(pal.ridgeNear, pal.id * 101 + 2, 130, 30);

  let rays: HTMLCanvasElement | null = null;
  if (pal.rays) {
    rays = document.createElement('canvas');
    rays.width = VIEW_W;
    rays.height = VIEW_H;
    const rctx = rays.getContext('2d')!;
    const rnd = makeRng(pal.id * 999);
    rctx.fillStyle = pal.accent;
    for (let i = 0; i < 5; i++) {
      const x0 = 30 + rnd() * 260;
      const width = 10 + rnd() * 26;
      rctx.globalAlpha = 0.05 + rnd() * 0.06;
      rctx.beginPath();
      rctx.moveTo(x0, -10);
      rctx.lineTo(x0 + width, -10);
      rctx.lineTo(x0 + width + 60, VIEW_H + 10);
      rctx.lineTo(x0 + 60, VIEW_H + 10);
      rctx.closePath();
      rctx.fill();
    }
    rctx.globalAlpha = 1;
  }

  return { sky, far, near, rays };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
