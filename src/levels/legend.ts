/** Single source of truth for level grid characters. */

export const SCREEN_COLS = 40;
export const SCREEN_ROWS = 23;

/** Tiles that become part of the collision grid. */
export const TILE_CHARS = {
  EMPTY: '.',
  SOLID: '#',
  SEMI: '%',
} as const;

/** Entity spawn characters. */
export const ENTITY_CHARS = {
  SPAWN: 'P',
  SPIKE_UP: '^',
  SPIKE_DOWN: 'v',
  SPIKE_LEFT: '<',
  SPIKE_RIGHT: '>',
  SPRING: 'S',
  CRYSTAL: '*',
  MOTE: 'o',
  CRUMBLE: 'C',
  DREAM: 'D',
  PLATFORM_A: 'M',
  PLATFORM_B: 'm',
  TEXT: 'T',
  FINALE: '!',
} as const;

export const ALL_CHARS = new Set<string>([
  ...Object.values(TILE_CHARS),
  ...Object.values(ENTITY_CHARS),
]);

export interface WindDef {
  x: number;
  y: number;
  /** 'steady' applies constantly; 'gust' toggles on/off on a timer. */
  mode: 'steady' | 'gust';
}

export interface ScreenDef {
  id: string;
  exits: { left?: string; right?: string; up?: string; down?: string };
  wind?: WindDef;
  /** One line shown when the player touches a 'T' tile (consumed in order). */
  texts?: string[];
  grid: string[];
}

export interface ChapterDef {
  id: number;
  name: string;
  /** Short epigraph shown on the chapter title card. */
  epigraph: string;
  screens: ScreenDef[];
}
