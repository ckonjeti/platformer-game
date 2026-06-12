import { describe, expect, it } from 'vitest';
import { overlaps, T_SOLID, TILE, type Rect } from '../src/engine/physics';
import { SPRING_SPEED } from '../src/game/constants';
import { parseScreen, type ParsedScreen } from '../src/game/level';
import { Player, type PlayerInput } from '../src/game/player';
import { SCREEN_COLS, SCREEN_ROWS, type ChapterDef, type ScreenDef } from '../src/levels/legend';
import { chapter1 } from '../src/levels/chapter1';
import { chapter2 } from '../src/levels/chapter2';

/**
 * Solvability: scripted (TAS-style) playthroughs of every enabled screen using
 * the real Player physics. Springs, spikes and fall-out deaths are emulated
 * exactly as the gameplay scene applies them; crumble blocks are treated as
 * solid, which matches a fresh screen (they outlast any single crossing).
 * A screen passes when the bot reaches its exit without dying.
 */

const EXIT_RIGHT = SCREEN_COLS * TILE - 4; // gameplay: p.x >= 316
const EXIT_UP = 2; // gameplay: p.y + p.h <= 2
const ROOM_H = SCREEN_ROWS * TILE;

function screenIn(ch: ChapterDef, id: string): ScreenDef {
  const s = ch.screens.find((s) => s.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
}

class Sim {
  parsed: ParsedScreen;
  p: Player;
  frame = 0;

  constructor(def: ScreenDef) {
    this.parsed = parseScreen(def);
    for (const c of this.parsed.crumbles) this.parsed.world.setTile(c.tx, c.ty, T_SOLID);
    this.p = new Player(this.parsed.world);
    this.p.spawnAt(this.parsed.spawn.x, this.parsed.spawn.y);
  }

  step(over: Partial<PlayerInput> = {}): void {
    const p = this.p;
    p.update({
      moveX: 0,
      moveY: 0,
      jumpHeld: false,
      jumpPressed: false,
      dashPressed: false,
      grabHeld: false,
      ...over,
    });
    for (const s of this.parsed.springs) {
      const hb: Rect = { x: s.x, y: s.y + 2, w: TILE, h: TILE - 2 };
      if (!p.dead && p.vy >= 0 && overlaps(p, hb)) p.bounce(SPRING_SPEED);
    }
    for (const s of this.parsed.spikes) {
      if (p.dead || !overlaps(p, s)) continue;
      if (
        (s.dir === 'up' && p.vy >= 0) ||
        (s.dir === 'down' && p.vy <= 0) ||
        (s.dir === 'left' && p.vx >= 0) ||
        (s.dir === 'right' && p.vx <= 0)
      ) {
        p.die();
      }
    }
    if (p.y > ROOM_H + 16 && !this.parsed.def.exits.down) p.die();
    // gameplay clamps the player at edges that have no exit
    const ex = this.parsed.def.exits;
    if (!ex.left && p.x < 0) p.x = 0;
    if (!ex.right && p.x > SCREEN_COLS * TILE - p.w) p.x = SCREEN_COLS * TILE - p.w;
    if (!ex.up && p.y < -8) p.y = -8;
    this.frame++;
    if (p.dead) throw new Error(`died at frame ${this.frame}, x=${p.x} y=${p.y}`);
    if (this.frame > 3600) throw new Error(`timeout, x=${p.x} y=${p.y}`);
  }

  run(over: Partial<PlayerInput>, frames: number): void {
    for (let i = 0; i < frames; i++) {
      this.step(over);
      over = { ...over, jumpPressed: false, dashPressed: false };
    }
  }

  until(cond: (p: Player) => boolean, over: Partial<PlayerInput> = {}, max = 1200): void {
    let n = 0;
    while (!cond(this.p) && n++ < max) {
      this.step(over);
      over = { ...over, jumpPressed: false, dashPressed: false };
    }
    if (!cond(this.p)) {
      throw new Error(`condition not met after ${max} frames, x=${this.p.x} y=${this.p.y}`);
    }
  }

  /** Walk along the ground until reaching x (within 2px), then settle. */
  walkTo(x: number): void {
    const dir = Math.sign(x - this.p.x) as -1 | 1;
    this.until((p) => (dir > 0 ? p.x >= x - 2 : p.x <= x + 2), { moveX: dir });
    this.run({}, 6); // bleed off speed
  }

  /**
   * Jump toward targetX, steering in the air so the landing centers there.
   * `hold` controls jump height (frames of sustained jump).
   */
  hop(targetX: number, hold = 14, maxFrames = 180): void {
    const dir0 = (Math.sign(targetX - this.p.x) || 1) as -1 | 1;
    this.step({ jumpPressed: true, jumpHeld: true, moveX: dir0 });
    for (let i = 0; i < maxFrames; i++) {
      const p = this.p;
      const mx = (p.x < targetX - 2 ? 1 : p.x > targetX + 2 ? -1 : 0) as -1 | 0 | 1;
      this.step({ moveX: mx, jumpHeld: i < hold });
      if (i > 8 && p.isOnGround()) return;
    }
    throw new Error(`hop to x=${targetX} never landed, x=${this.p.x} y=${this.p.y}`);
  }

  exitRight(): void {
    this.until((p) => p.x >= EXIT_RIGHT, { moveX: 1 });
  }
}

// ------------------------------------------------------------- chapter 1

describe('chapter 1 screens are completable', () => {
  it('1-1: walk, jump the step, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-1'));
    sim.until((p) => p.x >= 196, { moveX: 1 });
    sim.hop(232);
    sim.exitRight();
  });

  it('1-2: jump both pits, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-2'));
    sim.until((p) => p.x >= 84, { moveX: 1 });
    sim.hop(150);
    sim.until((p) => p.x >= 180, { moveX: 1 });
    sim.hop(260);
    sim.exitRight();
  });

  it('1-3: chain jumps across the four spike strips, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-3'));
    sim.until((p) => p.x >= 54, { moveX: 1 });
    sim.hop(116, 16); // safe zone cols 13-16
    sim.until((p) => p.x >= 120, { moveX: 1 });
    sim.hop(184, 16); // safe zone cols 22-25
    sim.until((p) => p.x >= 192, { moveX: 1 });
    sim.hop(254, 16); // safe zone cols 31-33
    sim.until((p) => p.x >= 258, { moveX: 1 });
    sim.hop(310, 16); // ground past the last strip
    sim.exitRight();
  });

  it('1-4: jump the first gap, then jump + air dash the wide one', () => {
    const sim = new Sim(screenIn(chapter1, '1-4'));
    sim.until((p) => p.x >= 56, { moveX: 1 });
    sim.hop(136); // island cols 15-19
    sim.until((p) => p.x >= 146, { moveX: 1 });
    sim.run({ moveX: 1, jumpPressed: true, jumpHeld: true }, 16);
    sim.run({ moveX: 1, jumpHeld: true, dashPressed: true }, 1);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 240);
    expect(sim.p.x).toBeGreaterThanOrEqual(217);
    sim.exitRight();
  });

  it('1-5: up-dash ascent across the high platforms, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-5'));
    // onto the mid platform (cols 8-12, top y=136) from its left
    sim.walkTo(50);
    sim.step({ jumpPressed: true, jumpHeld: true });
    sim.run({ jumpHeld: true }, 13);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 120);
    expect(sim.p.y).toBe(136 - sim.p.h);
    // jump + up-dash to the high platform (cols 6-9, top y=88), drifting left
    sim.walkTo(84);
    sim.step({ jumpPressed: true, jumpHeld: true });
    sim.run({ jumpHeld: true }, 11);
    sim.run({ dashPressed: true, moveY: -1 }, 1);
    sim.run({ moveY: -1 }, 8);
    sim.until((p) => p.isOnGround(), { moveX: -1 }, 180);
    expect(sim.p.y).toBe(88 - sim.p.h);
    // near-max hops between the 3-wide high platforms
    sim.until((p) => p.x >= 70, { moveX: 1 });
    sim.hop(128, 16); // cols 15-17
    sim.until((p) => p.x >= 130, { moveX: 1 });
    sim.hop(204, 16); // cols 24-26
    sim.until((p) => p.x >= 202, { moveX: 1 });
    sim.hop(276, 16); // cols 33-35
    sim.exitRight();
  });

  it('1-6: wall-jump up the shaft, exit top', () => {
    const sim = new Sim(screenIn(chapter1, '1-6'));
    sim.walkTo(130); // the only spike-free cell at the shaft floor
    // jump over the floor spikes onto the right wall, then ping-pong up
    sim.step({ moveX: 1, jumpPressed: true, jumpHeld: true });
    let dir: -1 | 1 = 1;
    let guard = 0;
    while (sim.p.y + sim.p.h > EXIT_UP && guard++ < 900) {
      if (sim.p.vy >= 0 && sim.p.wallAt(dir, 3)) {
        sim.step({ moveX: dir, jumpPressed: true, jumpHeld: true });
        dir = dir === 1 ? -1 : 1;
      } else {
        sim.step({ moveX: dir, jumpHeld: true });
      }
    }
    expect(sim.p.y + sim.p.h).toBeLessThanOrEqual(EXIT_UP);
    // the walls reach the screen top, so the exit column must be the shaft
    expect(sim.p.x).toBeGreaterThanOrEqual(128);
    expect(sim.p.x).toBeLessThanOrEqual(160);
  });

  it('1-6 → 1-7 seam: the entry chute can be climbed out of', () => {
    // gameplay places an upward arrival at the bottom edge with vy = -2
    const sim = new Sim(screenIn(chapter1, '1-7'));
    sim.p.spawnAt(145, ROOM_H - sim.p.h - 2);
    sim.p.vy = -2;
    // grab the chute wall, climb over the lip, stand on the main floor
    sim.until((p) => p.state === 'climb', { moveX: 1, grabHeld: true }, 90);
    sim.until((p) => p.state !== 'climb', { grabHeld: true, moveY: -1 }, 120);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 90);
    expect(sim.p.y).toBe(160 - sim.p.h);
  });

  it('1-7: climb the pillar, cross to the ledge, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-7'));
    sim.until((p) => p.x >= 188, { moveX: 1 });
    // jump over the base spikes at the wall and grab it
    sim.step({ moveX: 1, jumpPressed: true, jumpHeld: true, grabHeld: true });
    sim.until((p) => p.state === 'climb', { moveX: 1, jumpHeld: true, grabHeld: true }, 60);
    // climb to the top; the ledge-pop fires automatically with up held
    sim.until((p) => p.state !== 'climb', { grabHeld: true, moveY: -1 }, 300);
    // drift right onto the pillar top
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 60);
    expect(sim.p.y).toBe(48 - sim.p.h);
    // hop down-right onto the high ledge and leave
    sim.until((p) => p.x >= 228, { moveX: 1 });
    sim.hop(290);
    sim.exitRight();
  });

  it('1-8: spring launch + air dash across the pit, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-8'));
    sim.until((p) => p.vy < -4, { moveX: 1 }, 600); // ride into the spring
    sim.run({ moveX: 1 }, 18); // rise toward the apex
    sim.run({ moveX: 1, dashPressed: true }, 1);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 240);
    expect(sim.p.x).toBeGreaterThanOrEqual(217);
    sim.exitRight();
  });

  it('1-9: hop the 3-wide platforms over the spike bed, exit right', () => {
    const sim = new Sim(screenIn(chapter1, '1-9'));
    sim.until((p) => p.x >= 50, { moveX: 1 });
    sim.hop(88); // cols 10-12
    sim.until((p) => p.x >= 94, { moveX: 1 });
    sim.hop(146, 16); // cols 17-19
    sim.until((p) => p.x >= 150, { moveX: 1 });
    sim.hop(208, 16); // cols 25-27
    sim.until((p) => p.x >= 214, { moveX: 1 });
    sim.hop(284, 16); // right ledge cols 34-39
    sim.exitRight();
  });

  it('1-10: walk to the finale beacon', () => {
    const sim = new Sim(screenIn(chapter1, '1-10'));
    const f = sim.parsed.finale!;
    sim.until(
      (p) => Math.abs(p.x + 5 - (f.x + 4)) < 10 && Math.abs(p.y + 5 - (f.y + 4)) < 14,
      { moveX: 1 },
    );
  });
});

// ------------------------------------------------------------- chapter 2

describe('chapter 2 screens are completable', () => {
  it('2-1: cross the crumble bridges over the void, exit right', () => {
    const sim = new Sim(screenIn(chapter2, '2-1'));
    sim.until((p) => p.x >= 52, { moveX: 1 });
    sim.hop(92); // bridge cols 10-13
    sim.until((p) => p.x >= 100, { moveX: 1 });
    sim.hop(146, 16); // island cols 17-19, one row up
    sim.until((p) => p.x >= 148, { moveX: 1 });
    sim.hop(196); // bridge cols 23-26
    sim.until((p) => p.x >= 204, { moveX: 1 });
    sim.hop(252); // far floor
    sim.exitRight();
  });

  it('2-2: hop the crumble islands over the spikes', () => {
    const sim = new Sim(screenIn(chapter2, '2-2'));
    sim.until((p) => p.x >= 36, { moveX: 1 });
    sim.hop(68, 8); // C row17 cols 8-9
    sim.hop(116); // C row15 cols 14-15
    sim.hop(164, 8); // C row17 cols 20-21
    sim.hop(212); // C row15 cols 26-27
    sim.hop(284, 14); // long falling jump to the right ledge
    sim.exitRight();
  });
});
