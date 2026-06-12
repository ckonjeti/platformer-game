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
 *
 * The chapter is a vertical ascent: most screens end by climbing out of a
 * chimney at the top. A screen passes when the bot reaches its exit without
 * dying, and every up/down seam has a dedicated test proving the arrival
 * from below can climb out of the chute onto safe ground.
 */

const EXIT_RIGHT = SCREEN_COLS * TILE - 4; // gameplay: p.x >= 316
const EXIT_UP = 2; // gameplay: p.y + p.h <= 2 (while moving up)
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

  /**
   * Steer in the air toward targetX until landing. Always steps at least
   * once: a spring bounce leaves the player momentarily still grounded.
   */
  steerLand(targetX: number, max = 240): void {
    let n = 0;
    do {
      const mx = (this.p.x < targetX - 2 ? 1 : this.p.x > targetX + 2 ? -1 : 0) as -1 | 0 | 1;
      this.step({ moveX: mx });
    } while (!this.p.isOnGround() && n++ < max);
    if (!this.p.isOnGround()) {
      throw new Error(`never landed near x=${targetX}, x=${this.p.x} y=${this.p.y}`);
    }
  }

  /**
   * Standard chimney exit: hop into the wall on side `dir`, grab it, and
   * climb until the player crosses the top of the screen.
   */
  climbOutTop(dir: -1 | 1): void {
    this.step({ moveX: dir, jumpPressed: true, jumpHeld: true, grabHeld: true });
    this.until((p) => p.state === 'climb', { moveX: dir, jumpHeld: true, grabHeld: true }, 90);
    this.until((p) => p.y + p.h <= EXIT_UP, { grabHeld: true, moveY: -1 }, 600);
  }

  exitRight(): void {
    this.until((p) => p.x >= EXIT_RIGHT, { moveX: 1 });
  }
}

/**
 * Emulate an upward room transition: gameplay places the arrival at the
 * bottom edge of the destination, inside the chute, with vy = -2. The bot
 * grabs the chute wall on side `dir`, climbs over the lip and lands.
 */
function enterFromBelow(def: ScreenDef, x: number, dir: -1 | 1): Sim {
  const sim = new Sim(def);
  sim.p.spawnAt(x, ROOM_H - sim.p.h - 2);
  sim.p.vy = -2;
  sim.until((p) => p.state === 'climb', { moveX: dir, grabHeld: true }, 90);
  sim.until((p) => p.state !== 'climb', { grabHeld: true, moveY: -1 }, 300);
  sim.until((p) => p.isOnGround(), { moveX: dir }, 90);
  return sim;
}

// ------------------------------------------------------------- chapter 1

describe('chapter 1 screens are completable', () => {
  it('1-1: jump the three stair tiers, exit right at altitude', () => {
    const sim = new Sim(screenIn(chapter1, '1-1'));
    sim.until((p) => p.x >= 80, { moveX: 1 });
    sim.hop(104, 16);
    sim.until((p) => p.x >= 160, { moveX: 1 });
    sim.hop(184, 16);
    sim.until((p) => p.x >= 232, { moveX: 1 });
    sim.hop(256, 16);
    sim.exitRight();
    expect(sim.p.y).toBeLessThan(90); // leaves at the top tier, not the floor
  });

  it('1-2: ledge hops to the shelf, then climb out of the first chimney', () => {
    const sim = new Sim(screenIn(chapter1, '1-2'));
    sim.until((p) => p.x >= 56, { moveX: 1 });
    sim.hop(84, 16); // mid platform cols 10-12
    sim.until((p) => !p.isOnGround(), { moveX: 1 }); // run off the right edge
    sim.steerLand(134); // drop onto the shelf under the chimney (cols 16-19)
    expect(sim.p.y).toBe(88 - sim.p.h);
    sim.until((p) => p.x >= 144, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(128);
    expect(sim.p.x).toBeLessThanOrEqual(160);
  });

  it('1-3: wall-jump up the full-height chimney', () => {
    const sim = new Sim(screenIn(chapter1, '1-3'));
    sim.walkTo(228); // safe cells at the shaft floor (spikes hug the right wall)
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
    expect(sim.p.x).toBeGreaterThanOrEqual(224);
    expect(sim.p.x).toBeLessThanOrEqual(256);
  });

  it('1-4: cross the spike strips, zig-zag up the platforms, climb out', () => {
    const sim = new Sim(screenIn(chapter1, '1-4'));
    sim.until((p) => p.x >= 156, { moveX: 1 });
    sim.hop(204, 16); // over strip 21-23 to the chute side
    sim.until((p) => p.x <= 200, { moveX: -1 });
    sim.hop(152, 16); // back left onto the island (cols 18-20)
    sim.walkTo(158);
    sim.until((p) => p.x <= 148, { moveX: -1 });
    sim.hop(100, 16); // over the left strip onto the clear floor
    sim.walkTo(40);
    // climb the pillar on the far left (cols 2-3)
    sim.step({ moveX: -1, jumpPressed: true, jumpHeld: true, grabHeld: true });
    sim.until((p) => p.state === 'climb', { moveX: -1, jumpHeld: true, grabHeld: true }, 60);
    sim.until((p) => p.state !== 'climb', { grabHeld: true, moveY: -1 }, 400);
    sim.until((p) => p.isOnGround(), { moveX: -1 }, 90);
    expect(sim.p.y).toBe(64 - sim.p.h); // on the pillar top
    sim.until((p) => p.x >= 24, { moveX: 1 });
    sim.hop(80, 8); // drop right onto the chimney shelf (cols 8-11)
    sim.until((p) => p.x >= 86, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(64);
    expect(sim.p.x).toBeLessThanOrEqual(96);
  });

  it('1-5: jump + dash across the spike pit, dash hops up to the chimney', () => {
    const sim = new Sim(screenIn(chapter1, '1-5'));
    sim.until((p) => p.x >= 148, { moveX: 1 });
    sim.run({ moveX: 1, jumpPressed: true, jumpHeld: true }, 16);
    sim.run({ moveX: 1, jumpHeld: true, dashPressed: true }, 1);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 240);
    expect(sim.p.x).toBeGreaterThanOrEqual(215); // beyond the pit (cols 20-26)
    sim.until((p) => p.x >= 244, { moveX: 1 });
    sim.hop(268, 16); // A cols 33-35
    sim.until((p) => p.x <= 260, { moveX: -1 });
    sim.hop(234, 16); // B cols 28-30
    sim.until((p) => p.x <= 222, { moveX: -1 });
    sim.hop(192, 16); // C cols 23-25
    sim.until((p) => p.x >= 198, { moveX: 1 });
    // jump + dash right under the near wall onto the chimney shelf
    sim.run({ moveX: 1, jumpPressed: true, jumpHeld: true }, 12);
    sim.run({ moveX: 1, dashPressed: true }, 1);
    sim.steerLand(266);
    expect(sim.p.y).toBe(72 - sim.p.h); // standing on the shelf (cols 32-35)
    sim.until((p) => p.x >= 276, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(256);
    expect(sim.p.x).toBeLessThanOrEqual(288);
  });

  it('1-6: spring over the spikes onto the shelf, grab the wall, climb out', () => {
    const sim = new Sim(screenIn(chapter1, '1-6'));
    // run left and long-jump over the spike strip; the spring catches the
    // descent and launches
    sim.until((p) => p.x <= 208, { moveX: -1 });
    sim.step({ moveX: -1, jumpPressed: true, jumpHeld: true });
    sim.until((p) => p.vy < -4, { moveX: -1, jumpHeld: true }, 150);
    sim.steerLand(122); // drift onto the shelf (cols 14-16)
    expect(sim.p.y).toBe(120 - sim.p.h);
    sim.walkTo(126);
    // jump at the right wall (its lower end hangs into the room) and climb out
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(128);
    expect(sim.p.x).toBeLessThanOrEqual(160);
  });

  it('1-7: climb the stamina pillar, hop the spikes to the lip, climb out', () => {
    const sim = new Sim(screenIn(chapter1, '1-7'));
    sim.walkTo(184);
    sim.step({ moveX: 1, jumpPressed: true, jumpHeld: true, grabHeld: true });
    sim.until((p) => p.state === 'climb', { moveX: 1, jumpHeld: true, grabHeld: true }, 60);
    sim.until((p) => p.state !== 'climb', { grabHeld: true, moveY: -1 }, 400);
    sim.until((p) => p.isOnGround(), { moveX: 1 }, 90);
    expect(sim.p.y).toBe(64 - sim.p.h); // on the pillar top
    sim.until((p) => p.x >= 200, { moveX: 1 });
    sim.hop(248, 12); // over the base spikes onto the chimney shelf (cols 30-33)
    expect(sim.p.y).toBe(56 - sim.p.h);
    sim.until((p) => p.x >= 256, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(240);
    expect(sim.p.x).toBeLessThanOrEqual(272);
  });

  it('1-8: dash-jump left over the spikes, then up-dash into the chimney', () => {
    const sim = new Sim(screenIn(chapter1, '1-8'));
    sim.walkTo(208);
    sim.hop(196, 16); // A cols 22-24
    sim.until((p) => p.x <= 178, { moveX: -1 });
    // long dash-jump left across the spike strip to B (cols 12-14)
    sim.run({ moveX: -1, jumpPressed: true, jumpHeld: true }, 15);
    sim.run({ moveX: -1, dashPressed: true }, 1);
    sim.steerLand(102);
    expect(sim.p.y).toBe(112 - sim.p.h);
    sim.walkTo(102);
    // jump, then up-dash straight into the chimney and grab the left wall
    sim.run({ jumpPressed: true, jumpHeld: true }, 1);
    sim.run({ jumpHeld: true }, 10);
    sim.run({ dashPressed: true, moveY: -1 }, 1);
    sim.until((p) => p.state === 'climb', { moveX: -1, grabHeld: true }, 90);
    sim.until((p) => p.y + p.h <= EXIT_UP, { grabHeld: true, moveY: -1 }, 600);
    expect(sim.p.x).toBeGreaterThanOrEqual(96);
    expect(sim.p.x).toBeLessThanOrEqual(128);
  });

  it('1-9: spring, platform hops and a long dash over the spike bed', () => {
    const sim = new Sim(screenIn(chapter1, '1-9'));
    sim.until((p) => p.vy < -4, { moveX: -1 }, 300); // walk onto the spring
    sim.steerLand(14); // A cols 1-3
    expect(sim.p.y).toBe(128 - sim.p.h);
    sim.until((p) => p.x >= 20, { moveX: 1 });
    sim.hop(52, 16); // B cols 6-8
    sim.until((p) => p.x >= 54, { moveX: 1 });
    // dash-jump right over the chute and spikes to C (cols 16-18)
    sim.run({ moveX: 1, jumpPressed: true, jumpHeld: true }, 15);
    sim.run({ moveX: 1, dashPressed: true }, 1);
    sim.steerLand(134);
    expect(sim.p.y).toBe(80 - sim.p.h);
    sim.until((p) => p.x >= 146, { moveX: 1 });
    sim.hop(196, 12); // shelf in the chimney (cols 24-27)
    sim.until((p) => p.x >= 208, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(192);
    expect(sim.p.x).toBeLessThanOrEqual(224);
  });

  it('1-10: step up to the summit beacon', () => {
    const sim = new Sim(screenIn(chapter1, '1-10'));
    const f = sim.parsed.finale!;
    sim.hop(250, 12);
    sim.until(
      (p) => Math.abs(p.x + 5 - (f.x + 4)) < 10 && Math.abs(p.y + 5 - (f.y + 4)) < 14,
      { moveX: 1 },
    );
  });
});

// --------------------------------------------------- chapter 1 seams

describe('chapter 1 chimney seams can be climbed out of', () => {
  const seams: Array<{ to: string; x: number; dir: -1 | 1 }> = [
    { to: '1-3', x: 145, dir: 1 }, // 1-2 → 1-3, chute cols 16-19
    { to: '1-4', x: 240, dir: -1 }, // 1-3 → 1-4, chute cols 28-31
    { to: '1-5', x: 80, dir: 1 }, // 1-4 → 1-5, chute cols 8-11
    { to: '1-6', x: 270, dir: -1 }, // 1-5 → 1-6, chute cols 32-35
    { to: '1-7', x: 145, dir: 1 }, // 1-6 → 1-7, chute cols 16-19
    { to: '1-8', x: 250, dir: -1 }, // 1-7 → 1-8, chute cols 30-33
    { to: '1-9', x: 110, dir: -1 }, // 1-8 → 1-9, chute cols 12-15
    { to: '1-10', x: 210, dir: 1 }, // 1-9 → 1-10, chute cols 24-27
  ];
  for (const seam of seams) {
    it(`arrival in ${seam.to} climbs out of the chute onto the floor`, () => {
      const sim = enterFromBelow(screenIn(chapter1, seam.to), seam.x, seam.dir);
      expect(sim.p.y).toBe(160 - sim.p.h); // standing on the main floor
    });
  }
});

// ------------------------------------------------------------- chapter 2

describe('chapter 2 screens are completable', () => {
  it('2-1: climb the crumble stairs to the chimney', () => {
    const sim = new Sim(screenIn(chapter2, '2-1'));
    sim.until((p) => p.x >= 40, { moveX: 1 });
    sim.hop(70, 16); // c1 cols 8-10 (row 17)
    sim.until((p) => p.x >= 72, { moveX: 1 });
    sim.hop(100, 16); // c2 cols 12-14 (row 14)
    sim.until((p) => p.x >= 104, { moveX: 1 });
    sim.hop(132, 16); // c3 cols 16-18 (row 11)
    sim.until((p) => p.x >= 136, { moveX: 1 });
    sim.hop(168, 14); // c4 cols 21-23 (row 9)
    sim.until((p) => p.x >= 180, { moveX: 1 });
    sim.hop(212, 12); // c5 cols 26-28 (row 9)
    sim.until((p) => p.x >= 222, { moveX: 1 });
    sim.hop(246, 12); // shelf in the chimney (cols 30-33)
    sim.until((p) => p.x >= 258, { moveX: 1 });
    sim.climbOutTop(1);
    expect(sim.p.x).toBeGreaterThanOrEqual(240);
    expect(sim.p.x).toBeLessThanOrEqual(272);
  });

  it('2-1 → 2-2 seam: the chute can be climbed out of', () => {
    const sim = enterFromBelow(screenIn(chapter2, '2-2'), 250, -1);
    expect(sim.p.y).toBe(160 - sim.p.h);
  });

  it('2-2: crumble ladder over the spike bed to the summit', () => {
    const sim = new Sim(screenIn(chapter2, '2-2'));
    sim.walkTo(218);
    sim.hop(186, 16); // c1 cols 22-24 (row 17)
    sim.hop(146, 16); // c2 cols 17-19 (row 14)
    sim.hop(106, 16); // c3 cols 12-14 (row 11)
    sim.hop(66, 16); // c4 cols 7-9 (row 8)
    sim.hop(24, 16); // summit cols 2-4 (rows 5-6)
    // the preview build injects the finale beacon above the summit platform
    expect(sim.p.y).toBe(40 - sim.p.h);
  });
});
