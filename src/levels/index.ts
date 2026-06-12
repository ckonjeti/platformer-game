import { chapter1 } from './chapter1';
import { chapter2 } from './chapter2';
import type { ChapterDef, ScreenDef } from './legend';

/**
 * PREVIEW BUILD: only the first N screens are registered while the game is
 * being play-tested. Dangling exits are stripped and a finale beacon is
 * placed in the last screen so the loop is completable.
 * To restore the full game, export the chapters unmodified.
 */
function previewSlice(
  ch: ChapterDef,
  count: number,
  beacon: { row: number; col: number } = { row: 17, col: 36 },
): ChapterDef {
  const screens = ch.screens.slice(0, count).map((s) => ({ ...s, exits: { ...s.exits } }));
  const ids = new Set(screens.map((s) => s.id));
  for (const s of screens) {
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      const target = s.exits[dir];
      if (target && !ids.has(target)) delete s.exits[dir];
    }
  }
  const last = screens[screens.length - 1]!;
  if (!last.grid.join('').includes('!')) {
    last.grid = [...last.grid];
    const row = last.grid[beacon.row]!;
    last.grid[beacon.row] = row.slice(0, beacon.col) + '!' + row.slice(beacon.col + 1);
  }
  return { ...ch, screens };
}

// The 2-2 beacon sits on the summit platform at the top-left of the climb.
export const CHAPTERS: ChapterDef[] = [chapter1, previewSlice(chapter2, 2, { row: 3, col: 3 })];

const screenIndex = new Map<string, ScreenDef>();
for (const ch of CHAPTERS) {
  for (const s of ch.screens) screenIndex.set(s.id, s);
}

export function findScreen(id: string): ScreenDef | undefined {
  return screenIndex.get(id);
}

export function totalMotes(): number {
  let count = 0;
  for (const ch of CHAPTERS) {
    for (const s of ch.screens) {
      for (const row of s.grid) {
        for (const c of row) if (c === 'o') count++;
      }
    }
  }
  return count;
}
