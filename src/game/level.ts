import { T_SEMI, T_SOLID, TILE, World, type Rect } from '../engine/physics';
import {
  ENTITY_CHARS as E,
  SCREEN_COLS,
  SCREEN_ROWS,
  TILE_CHARS as T,
  type ScreenDef,
} from '../levels/legend';
import { PLAYER_H } from './constants';

export type SpikeDir = 'up' | 'down' | 'left' | 'right';

export interface SpikeSpawn extends Rect {
  dir: SpikeDir;
  /** Tile position, for rendering. */
  tx: number;
  ty: number;
}

export interface PointSpawn {
  tx: number;
  ty: number;
  x: number;
  y: number;
}

export interface ParsedScreen {
  def: ScreenDef;
  world: World;
  spawn: { x: number; y: number };
  spikes: SpikeSpawn[];
  springs: PointSpawn[];
  crystals: PointSpawn[];
  motes: PointSpawn[];
  crumbles: PointSpawn[];
  texts: PointSpawn[];
  finale: PointSpawn | null;
  dreamRects: Rect[];
  platforms: { from: PointSpawn; to: PointSpawn }[];
}

const SPIKE_DIRS: Record<string, SpikeDir> = {
  [E.SPIKE_UP]: 'up',
  [E.SPIKE_DOWN]: 'down',
  [E.SPIKE_LEFT]: 'left',
  [E.SPIKE_RIGHT]: 'right',
};

/** 4px-deep hitbox on the pointed side of the spike tile. */
function spikeRect(dir: SpikeDir, tx: number, ty: number): Rect {
  const x = tx * TILE;
  const y = ty * TILE;
  switch (dir) {
    case 'up':
      return { x: x + 1, y: y + 4, w: TILE - 2, h: 4 };
    case 'down':
      return { x: x + 1, y, w: TILE - 2, h: 4 };
    case 'left':
      return { x: x + 4, y: y + 1, w: 4, h: TILE - 2 };
    case 'right':
      return { x, y: y + 1, w: 4, h: TILE - 2 };
  }
}

function pointSpawn(tx: number, ty: number): PointSpawn {
  return { tx, ty, x: tx * TILE, y: ty * TILE };
}

export function parseScreen(def: ScreenDef): ParsedScreen {
  const world = new World(SCREEN_COLS, SCREEN_ROWS);
  const out: ParsedScreen = {
    def,
    world,
    spawn: { x: 16, y: 0 },
    spikes: [],
    springs: [],
    crystals: [],
    motes: [],
    crumbles: [],
    texts: [],
    finale: null,
    dreamRects: [],
    platforms: [],
  };

  const dreamMask: boolean[] = new Array(SCREEN_COLS * SCREEN_ROWS).fill(false);
  const platformA: PointSpawn[] = [];
  const platformB: PointSpawn[] = [];

  def.grid.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx]!;
      switch (ch) {
        case T.SOLID:
          world.setTile(tx, ty, T_SOLID);
          break;
        case T.SEMI:
          world.setTile(tx, ty, T_SEMI);
          break;
        case E.SPAWN:
          // Feet on the bottom edge of the spawn tile
          out.spawn = { x: tx * TILE, y: (ty + 1) * TILE - PLAYER_H };
          break;
        case E.SPIKE_UP:
        case E.SPIKE_DOWN:
        case E.SPIKE_LEFT:
        case E.SPIKE_RIGHT: {
          const dir = SPIKE_DIRS[ch]!;
          out.spikes.push({ ...spikeRect(dir, tx, ty), dir, tx, ty });
          break;
        }
        case E.SPRING:
          out.springs.push(pointSpawn(tx, ty));
          break;
        case E.CRYSTAL:
          out.crystals.push(pointSpawn(tx, ty));
          break;
        case E.MOTE:
          out.motes.push(pointSpawn(tx, ty));
          break;
        case E.CRUMBLE:
          out.crumbles.push(pointSpawn(tx, ty));
          break;
        case E.TEXT:
          out.texts.push(pointSpawn(tx, ty));
          break;
        case E.FINALE:
          out.finale = pointSpawn(tx, ty);
          break;
        case E.DREAM:
          dreamMask[ty * SCREEN_COLS + tx] = true;
          break;
        case E.PLATFORM_A:
          platformA.push(pointSpawn(tx, ty));
          break;
        case E.PLATFORM_B:
          platformB.push(pointSpawn(tx, ty));
          break;
      }
    }
  });

  // Merge contiguous dream tiles into maximal rectangles
  const visited = new Set<number>();
  for (let ty = 0; ty < SCREEN_ROWS; ty++) {
    for (let tx = 0; tx < SCREEN_COLS; tx++) {
      const idx = ty * SCREEN_COLS + tx;
      if (!dreamMask[idx] || visited.has(idx)) continue;
      let w = 0;
      while (tx + w < SCREEN_COLS && dreamMask[ty * SCREEN_COLS + tx + w] && !visited.has(ty * SCREEN_COLS + tx + w)) w++;
      let h = 1;
      outer: while (ty + h < SCREEN_ROWS) {
        for (let i = 0; i < w; i++) {
          if (!dreamMask[(ty + h) * SCREEN_COLS + tx + i]) break outer;
        }
        h++;
      }
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) visited.add((ty + dy) * SCREEN_COLS + tx + dx);
      }
      out.dreamRects.push({ x: tx * TILE, y: ty * TILE, w: w * TILE, h: h * TILE });
    }
  }

  // Pair platform waypoints in scan order
  for (let i = 0; i < platformA.length; i++) {
    const from = platformA[i]!;
    const to = platformB[i];
    if (to) out.platforms.push({ from, to });
  }

  return out;
}
