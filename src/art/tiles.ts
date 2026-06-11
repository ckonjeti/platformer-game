import { makeRng } from '../engine/rng';
import { TILE } from '../engine/physics';
import type { ChapterPalette } from './palettes';

/**
 * 4-bit autotiled terrain: mask bits 1=solid above, 2=solid right, 4=solid below, 8=solid left.
 * Exposed edges get a highlight (top) or shadow; interiors get seeded dither.
 */
export function buildTerrainTiles(pal: ChapterPalette): HTMLCanvasElement[] {
  const tiles: HTMLCanvasElement[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = pal.terrain;
    ctx.fillRect(0, 0, TILE, TILE);

    // Seeded interior dither for texture
    const rnd = makeRng(mask * 7919 + pal.id * 104729);
    ctx.fillStyle = pal.terrainDark;
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rnd() * TILE);
      const y = Math.floor(rnd() * TILE);
      ctx.fillRect(x, y, 1, 1);
    }

    const up = (mask & 1) !== 0;
    const right = (mask & 2) !== 0;
    const down = (mask & 4) !== 0;
    const left = (mask & 8) !== 0;

    if (!up) {
      ctx.fillStyle = pal.terrainEdge;
      ctx.fillRect(0, 0, TILE, 2);
    }
    if (!down) {
      ctx.fillStyle = pal.terrainDark;
      ctx.fillRect(0, TILE - 2, TILE, 2);
    }
    if (!left) {
      ctx.fillStyle = pal.terrainEdge;
      ctx.fillRect(0, 0, 1, TILE);
      ctx.fillStyle = pal.terrainDark;
      ctx.fillRect(1, up ? 0 : 2, 1, TILE);
    }
    if (!right) {
      ctx.fillStyle = pal.terrainDark;
      ctx.fillRect(TILE - 1, 0, 1, TILE);
    }
    tiles.push(c);
  }
  return tiles;
}

/** Thin one-way platform tile. */
export function buildSemiTile(pal: ChapterPalette): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = pal.terrainEdge;
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillStyle = pal.terrain;
  ctx.fillRect(0, 1, TILE, 2);
  ctx.fillStyle = pal.terrainDark;
  ctx.fillRect(0, 3, TILE, 1);
  return c;
}
