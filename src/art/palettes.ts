/** Five chapter palettes tracing the arc from ignorance (gray fog) to liberation (luminous gold). */

export interface PlayerPalette {
  outline: string;
  cloak: string;
  shade: string;
  face: string;
  light: string;
}

export interface ChapterPalette {
  id: number;
  /** Sky gradient. */
  bgTop: string;
  bgBottom: string;
  ridgeFar: string;
  ridgeNear: string;
  terrain: string;
  terrainEdge: string;
  terrainDark: string;
  spike: string;
  accent: string;
  textColor: string;
  fogColor: string;
  fogAlpha: number;
  player: PlayerPalette;
  /** Hood up in early chapters. */
  hooded: boolean;
  /** 0..1 strength of the player's glow aura. */
  aura: number;
  stars: boolean;
  rays: boolean;
  ambientMotes: number;
}

export const PALETTES: ChapterPalette[] = [
  {
    id: 1,
    bgTop: '#0d0f1a',
    bgBottom: '#1c2233',
    ridgeFar: '#161b29',
    ridgeNear: '#202739',
    terrain: '#39445a',
    terrainEdge: '#56657f',
    terrainDark: '#252d3f',
    spike: '#717f96',
    accent: '#8aa2c8',
    textColor: '#9aa7bd',
    fogColor: '#39445a',
    fogAlpha: 0.4,
    player: { outline: '#10131d', cloak: '#3d4659', shade: '#2b3242', face: '#8d99ad', light: '#aab8cf' },
    hooded: true,
    aura: 0,
    stars: false,
    rays: false,
    ambientMotes: 0,
  },
  {
    id: 2,
    bgTop: '#120f22',
    bgBottom: '#2a2342',
    ridgeFar: '#1b1733',
    ridgeNear: '#272047',
    terrain: '#453a68',
    terrainEdge: '#67598f',
    terrainDark: '#2e2747',
    spike: '#8d7fb5',
    accent: '#a18ed1',
    textColor: '#b1a3d6',
    fogColor: '#453a68',
    fogAlpha: 0.28,
    player: { outline: '#130f22', cloak: '#4c4170', shade: '#362e52', face: '#a4a0c2', light: '#c5bfe3', },
    hooded: true,
    aura: 0.12,
    stars: true,
    rays: false,
    ambientMotes: 4,
  },
  {
    id: 3,
    bgTop: '#1a2333',
    bgBottom: '#3d4f6e',
    ridgeFar: '#26334a',
    ridgeNear: '#33425e',
    terrain: '#4b5f80',
    terrainEdge: '#7289ab',
    terrainDark: '#334359',
    spike: '#8fa3c2',
    accent: '#d9ab57',
    textColor: '#d3c194',
    fogColor: '#4b5f80',
    fogAlpha: 0.16,
    player: { outline: '#1b2028', cloak: '#5a6c8c', shade: '#43526c', face: '#e8cfa8', light: '#ecd9a0' },
    hooded: false,
    aura: 0.3,
    stars: true,
    rays: false,
    ambientMotes: 8,
  },
  {
    id: 4,
    bgTop: '#2c3a5c',
    bgBottom: '#7287b3',
    ridgeFar: '#41527a',
    ridgeNear: '#566a96',
    terrain: '#7d90b8',
    terrainEdge: '#aebede',
    terrainDark: '#5b6c92',
    spike: '#c0cde7',
    accent: '#f2d390',
    textColor: '#f0e3bb',
    fogColor: '#8ea0c6',
    fogAlpha: 0.07,
    player: { outline: '#2a3146', cloak: '#93a5c9', shade: '#7488ae', face: '#f3dcb4', light: '#ffe9a8' },
    hooded: false,
    aura: 0.55,
    stars: false,
    rays: true,
    ambientMotes: 14,
  },
  {
    id: 5,
    bgTop: '#7e96c7',
    bgBottom: '#f7eed7',
    ridgeFar: '#a4b6dc',
    ridgeNear: '#c2cfe9',
    terrain: '#d3dcef',
    terrainEdge: '#fbf6e4',
    terrainDark: '#aebbd8',
    spike: '#94a4c4',
    accent: '#ffe9a0',
    textColor: '#fffbe8',
    fogColor: '#ffffff',
    fogAlpha: 0,
    player: { outline: '#5b688c', cloak: '#e9ecf5', shade: '#c6cee2', face: '#ffe9c4', light: '#fff6c8' },
    hooded: false,
    aura: 1,
    stars: false,
    rays: true,
    ambientMotes: 22,
  },
];

/** Mix two hex colors; t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function paletteFor(chapter: number): ChapterPalette {
  return PALETTES[Math.min(Math.max(chapter, 1), PALETTES.length) - 1]!;
}
