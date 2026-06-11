import { describe, expect, it } from 'vitest';
import { TILE } from '../src/engine/physics';
import * as C from '../src/game/constants';
import { idleInput, playerOn, sim, worldFrom } from './helpers';

const ROOM = [
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
];

function freshPlayer() {
  const w = worldFrom(ROOM);
  return playerOn(w, 5, 9);
}

describe('jumping', () => {
  it('full hold reaches ~3.5 tiles', () => {
    const p = freshPlayer();
    const startY = p.y;
    p.update(idleInput({ jumpPressed: true, jumpHeld: true }));
    let minY = p.y;
    for (let i = 0; i < 60; i++) {
      p.update(idleInput({ jumpHeld: true }));
      minY = Math.min(minY, p.y);
    }
    const tiles = (startY - minY) / TILE;
    expect(tiles).toBeGreaterThan(3);
    expect(tiles).toBeLessThan(4.2);
  });

  it('a tap jump is much shorter than a held jump', () => {
    const p = freshPlayer();
    const startY = p.y;
    p.update(idleInput({ jumpPressed: true, jumpHeld: true }));
    p.update(idleInput({ jumpHeld: true }));
    let minY = p.y;
    for (let i = 0; i < 60; i++) {
      p.update(idleInput()); // released
      minY = Math.min(minY, p.y);
    }
    const tiles = (startY - minY) / TILE;
    expect(tiles).toBeLessThan(2);
    expect(tiles).toBeGreaterThan(0.5);
  });

  it('coyote time allows a jump within grace frames after walking off a ledge', () => {
    const w = worldFrom([
      '....................',
      '....................',
      '....................',
      '#####...............',
    ]);
    // Deterministic: one grounded update arms the grace timer, then teleport
    // into the air well clear of the ledge wall, wait, and try to jump.
    const tryAfter = (frames: number): boolean => {
      const q = playerOn(w, 3, 3);
      q.update(idleInput()); // grounded → grace armed
      q.x = 5 * TILE + 8; // airborne, away from the ledge's side wall
      for (let i = 0; i < frames; i++) q.update(idleInput());
      q.update(idleInput({ jumpPressed: true, jumpHeld: true }));
      return q.vy === C.JUMP_SPEED;
    };
    expect(tryAfter(C.JUMP_GRACE - 2)).toBe(true);
    expect(tryAfter(C.JUMP_GRACE + 4)).toBe(false);
  });

  it('jump buffer fires a jump on landing', () => {
    const p = freshPlayer();
    const groundY = p.y + p.h;
    // Fall from 30px up until just above the ground, then press jump early
    p.spawnAt(p.x, groundY - p.h - 30);
    let guard = 0;
    while (groundY - (p.y + p.h) > 8 && guard++ < 120) p.update(idleInput());
    p.update(idleInput({ jumpPressed: true, jumpHeld: true }));
    let jumped = false;
    for (let i = 0; i < C.JUMP_BUFFER + 4 && !jumped; i++) {
      p.update(idleInput({ jumpHeld: true }));
      if (p.vy < 0) jumped = true;
    }
    expect(jumped).toBe(true);
  });
});

describe('dashing', () => {
  it('covers ~36px of fixed-speed travel plus retained momentum', () => {
    const p = freshPlayer();
    const startX = p.x;
    p.update(idleInput({ dashPressed: true, moveX: 1 }));
    for (let i = 0; i < C.DASH_TIME; i++) p.update(idleInput({ moveX: 1 }));
    const dashDist = p.x - startX;
    expect(dashDist).toBeGreaterThanOrEqual(C.DASH_SPEED * C.DASH_TIME - 2);
    expect(dashDist).toBeLessThanOrEqual(C.DASH_SPEED * (C.DASH_TIME + 1) + 2);
  });

  it('only one dash per airtime; refills on landing', () => {
    const p = freshPlayer();
    p.spawnAt(p.x, p.y - 40);
    expect(p.dashes).toBe(1);
    p.update(idleInput({ dashPressed: true, moveX: 1 }));
    expect(p.dashes).toBe(0);
    // Cooldown passes, still airborne: second dash must not start
    sim(p, idleInput(), C.DASH_COOLDOWN + 2);
    const stateBefore = p.state;
    p.update(idleInput({ dashPressed: true, moveX: 1 }));
    expect(p.state).toBe(stateBefore);
    // Land → refilled
    sim(p, idleInput(), 60);
    expect(p.isOnGround()).toBe(true);
    expect(p.dashes).toBe(1);
  });

  it('upward dash travels up', () => {
    const p = freshPlayer();
    const startY = p.y;
    p.update(idleInput({ dashPressed: true, moveY: -1 }));
    for (let i = 0; i < C.DASH_TIME; i++) p.update(idleInput({ moveY: -1 }));
    expect(startY - p.y).toBeGreaterThan(20);
  });
});

describe('walls', () => {
  const WALL_ROOM = [
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '####################',
  ];

  it('wall slide caps fall speed', () => {
    const w = worldFrom(WALL_ROOM);
    const p = playerOn(w, 1, 7);
    p.spawnAt(TILE, TILE); // top of left wall
    sim(p, idleInput({ moveX: -1 }), 25);
    expect(p.vy).toBeLessThanOrEqual(C.WALL_SLIDE_MAX);
    expect(p.vy).toBeGreaterThan(0);
  });

  it('wall jump pushes away from the wall', () => {
    const w = worldFrom(WALL_ROOM);
    const p = playerOn(w, 1, 7);
    p.spawnAt(TILE, 3 * TILE);
    sim(p, idleInput({ moveX: -1 }), 5); // press into wall, falling
    p.update(idleInput({ jumpPressed: true, jumpHeld: true, moveX: -1 }));
    expect(p.vy).toBe(C.JUMP_SPEED);
    expect(p.vx).toBe(C.WALL_JUMP_HX);
  });

  it('climbing drains stamina and forced slide at zero', () => {
    const w = worldFrom(WALL_ROOM);
    const p = playerOn(w, 1, 7);
    p.spawnAt(TILE, 3 * TILE);
    p.facing = -1;
    // Hang on the wall without moving
    sim(p, idleInput({ grabHeld: true, moveX: -1 }), 10);
    expect(p.state).toBe('climb');
    expect(p.stamina).toBeLessThan(C.MAX_STAMINA);
    // Drain it all
    p.stamina = 0.5;
    sim(p, idleInput({ grabHeld: true, moveX: -1 }), 5);
    expect(p.state).not.toBe('climb');
    // Ground refills
    sim(p, idleInput(), 120);
    expect(p.isOnGround()).toBe(true);
    expect(p.stamina).toBe(C.MAX_STAMINA);
  });

  it('climbing up moves the player up the wall', () => {
    const w = worldFrom(WALL_ROOM);
    const p = playerOn(w, 1, 7);
    p.spawnAt(TILE, 4 * TILE);
    p.facing = -1;
    const startY = p.y;
    sim(p, idleInput({ grabHeld: true, moveX: -1, moveY: -1 }), 20);
    expect(p.y).toBeLessThan(startY);
  });
});

describe('death', () => {
  it('die() sets dead state and fires the event once', () => {
    const p = freshPlayer();
    let deaths = 0;
    p.events.onDeath = () => deaths++;
    p.die();
    p.die();
    expect(p.dead).toBe(true);
    expect(deaths).toBe(1);
    // No movement while dead
    const x = p.x;
    sim(p, idleInput({ moveX: 1 }), 10);
    expect(p.x).toBe(x);
  });
});
