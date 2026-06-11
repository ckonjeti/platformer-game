import { chapter1 } from './chapter1';
import type { ChapterDef, ScreenDef } from './legend';

export const CHAPTERS: ChapterDef[] = [chapter1];

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
