import { World, T_SOLID, T_SEMI, TILE } from '../src/engine/physics';
import { Player, type PlayerInput } from '../src/game/player';

/** Build a World from ASCII rows: '#' solid, '%' semisolid, '.' empty. */
export function worldFrom(rows: string[]): World {
  const w = new World(rows[0]!.length, rows.length);
  rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      if (ch === '#') w.setTile(tx, ty, T_SOLID);
      else if (ch === '%') w.setTile(tx, ty, T_SEMI);
    }
  });
  return w;
}

export function idleInput(over: Partial<PlayerInput> = {}): PlayerInput {
  return {
    moveX: 0,
    moveY: 0,
    jumpHeld: false,
    jumpPressed: false,
    dashPressed: false,
    grabHeld: false,
    ...over,
  };
}

/** Place a player standing on the tile row `groundTy`, at tile column `tx`. */
export function playerOn(world: World, tx: number, groundTy: number): Player {
  const p = new Player(world);
  p.spawnAt(tx * TILE, groundTy * TILE - p.h);
  return p;
}

/** Run n frames with the given (static) input. */
export function sim(p: Player, input: PlayerInput, frames: number): void {
  for (let i = 0; i < frames; i++) {
    p.update(input);
    // edge-triggered fields only fire one frame
    input = { ...input, jumpPressed: false, dashPressed: false };
  }
}
