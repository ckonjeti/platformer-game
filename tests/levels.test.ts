import { describe, expect, it } from 'vitest';
import { CHAPTERS, findScreen } from '../src/levels';
import { ALL_CHARS, SCREEN_COLS, SCREEN_ROWS } from '../src/levels/legend';

describe('level data', () => {
  for (const ch of CHAPTERS) {
    describe(`chapter ${ch.id}: ${ch.name}`, () => {
      for (const screen of ch.screens) {
        it(`screen ${screen.id} is structurally valid`, () => {
          expect(screen.grid.length, `${screen.id} row count`).toBe(SCREEN_ROWS);
          screen.grid.forEach((row, i) => {
            expect(row.length, `${screen.id} row ${i} width (got ${row.length})`).toBe(SCREEN_COLS);
            for (const c of row) {
              expect(ALL_CHARS.has(c), `${screen.id} row ${i} has invalid char '${c}'`).toBe(true);
            }
          });
          // Exactly one player spawn
          const spawns = screen.grid.join('').split('').filter((c) => c === 'P').length;
          expect(spawns, `${screen.id} spawn count`).toBe(1);
          // All exits resolve
          for (const [dir, target] of Object.entries(screen.exits)) {
            expect(findScreen(target), `${screen.id} exit ${dir} → ${target}`).toBeDefined();
          }
          // Platform waypoints are paired
          const all = screen.grid.join('');
          const m1 = all.split('').filter((c) => c === 'M').length;
          const m2 = all.split('').filter((c) => c === 'm').length;
          expect(m1, `${screen.id} platform waypoints`).toBe(m2);
          // Text triggers have matching lines
          const triggers = all.split('').filter((c) => c === 'T').length;
          expect(screen.texts?.length ?? 0, `${screen.id} text lines vs triggers`).toBe(triggers);
        });
      }

      it(`chapter ${ch.id} screens are connected from the first screen`, () => {
        const seen = new Set<string>();
        const queue = [ch.screens[0]!.id];
        while (queue.length > 0) {
          const id = queue.pop()!;
          if (seen.has(id)) continue;
          seen.add(id);
          const s = findScreen(id)!;
          for (const target of Object.values(s.exits)) {
            if (!seen.has(target)) queue.push(target);
          }
        }
        for (const s of ch.screens) {
          expect(seen.has(s.id), `screen ${s.id} unreachable`).toBe(true);
        }
      });

      it(`chapter ${ch.id} has a finale or onward path`, () => {
        const hasFinale = ch.screens.some((s) => s.grid.join('').includes('!'));
        expect(hasFinale, `chapter ${ch.id} needs a '!' finale trigger`).toBe(true);
      });
    });
  }
});
