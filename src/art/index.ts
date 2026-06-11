import { buildBackground, type BackgroundArt } from './background';
import { mixHex, paletteFor, type ChapterPalette } from './palettes';
import {
  buildCrumbleSprite,
  buildCrystalSprites,
  buildMoteSprites,
  buildPlayerSprites,
  buildSpikeSprites,
  buildSpringSprites,
  type DirectionalAnims,
} from './sprites';
import { buildSemiTile, buildTerrainTiles } from './tiles';

export interface ChapterArt {
  pal: ChapterPalette;
  player: DirectionalAnims;
  /** Dimmed sprite set shown while the dash is spent. */
  playerSpent: DirectionalAnims;
  terrain: HTMLCanvasElement[];
  semi: HTMLCanvasElement;
  spring: HTMLCanvasElement[];
  crystal: HTMLCanvasElement[];
  mote: HTMLCanvasElement[];
  crumble: HTMLCanvasElement;
  spikes: Record<'up' | 'down' | 'left' | 'right', HTMLCanvasElement>;
  bg: BackgroundArt;
  aura: HTMLCanvasElement | null;
}

const cache = new Map<number, ChapterArt>();

function buildAura(pal: ChapterPalette): HTMLCanvasElement | null {
  if (pal.aura <= 0) return null;
  const r = Math.round(10 + pal.aura * 14);
  const c = document.createElement('canvas');
  c.width = r * 2;
  c.height = r * 2;
  const ctx = c.getContext('2d')!;
  for (let i = 4; i > 0; i--) {
    ctx.globalAlpha = 0.045 * pal.aura * i;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(r, r, (r * (5 - i)) / 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function chapterArt(chapter: number): ChapterArt {
  const hit = cache.get(chapter);
  if (hit) return hit;
  const pal = paletteFor(chapter);
  const spentPal: ChapterPalette = {
    ...pal,
    player: {
      outline: pal.player.outline,
      cloak: mixHex(pal.player.cloak, '#202637', 0.55),
      shade: mixHex(pal.player.shade, '#161a28', 0.55),
      face: mixHex(pal.player.face, '#3a4356', 0.45),
      light: mixHex(pal.player.light, '#3a4356', 0.6),
    },
  };
  const art: ChapterArt = {
    pal,
    player: buildPlayerSprites(pal),
    playerSpent: buildPlayerSprites(spentPal),
    terrain: buildTerrainTiles(pal),
    semi: buildSemiTile(pal),
    spring: buildSpringSprites(pal),
    crystal: buildCrystalSprites(pal),
    mote: buildMoteSprites(pal),
    crumble: buildCrumbleSprite(pal),
    spikes: buildSpikeSprites(pal),
    bg: buildBackground(pal),
    aura: buildAura(pal),
  };
  cache.set(chapter, art);
  return art;
}
