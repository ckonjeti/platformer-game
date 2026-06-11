import { describe, expect, it } from 'vitest';
import { Actor, Solid, TILE } from '../src/engine/physics';
import { worldFrom } from './helpers';

const FLAT = [
  '..........',
  '..........',
  '..........',
  '..........',
  '##########',
];

describe('Actor movement', () => {
  it('accumulates sub-pixel remainders', () => {
    const w = worldFrom(FLAT);
    const a = new Actor(w);
    a.x = 8;
    a.y = 24; // standing on ground (h=8 → bottom=32)
    for (let i = 0; i < 10; i++) a.moveX(0.3);
    expect(a.x).toBe(11); // 10 * 0.3 = 3 px
  });

  it('stops flush against a solid wall', () => {
    const w = worldFrom([
      '.....#....',
      '.....#....',
      '.....#....',
      '.....#....',
      '##########',
    ]);
    const a = new Actor(w);
    a.x = 8;
    a.y = 24;
    const hit = a.moveX(100);
    expect(hit).toBe(true);
    expect(a.x).toBe(5 * TILE - a.w); // flush with wall at tile 5
  });

  it('lands flush on the floor', () => {
    const w = worldFrom(FLAT);
    const a = new Actor(w);
    a.x = 8;
    a.y = 0;
    a.moveY(100);
    expect(a.y + a.h).toBe(4 * TILE);
    expect(a.isOnGround()).toBe(true);
  });

  it('passes through semisolids from below but lands from above', () => {
    const w = worldFrom([
      '..........',
      '..%%%.....',
      '..........',
      '..........',
      '##########',
    ]);
    const a = new Actor(w);
    // From below: jump up through the platform
    a.x = 24;
    a.y = 20;
    const hitUp = a.moveY(-20);
    expect(hitUp).toBe(false);
    expect(a.y).toBe(0);
    // From above: land on it
    const hitDown = a.moveY(30);
    expect(hitDown).toBe(true);
    expect(a.y + a.h).toBe(1 * TILE);
  });
});

describe('Solid (moving platform)', () => {
  it('carries a rider standing on top', () => {
    const w = worldFrom(FLAT);
    const s = new Solid(w, 16, 24, 16, 8);
    w.solids.push(s);
    const a = new Actor(w);
    a.x = 20;
    a.y = 24 - a.h;
    s.move(5, 0, [a]);
    expect(a.x).toBe(25);
  });

  it('pushes an actor out of the way', () => {
    const w = worldFrom(FLAT);
    const s = new Solid(w, 0, 16, 16, 8);
    w.solids.push(s);
    const a = new Actor(w);
    a.x = 18;
    a.y = 16;
    s.move(6, 0, [a]);
    expect(a.x).toBe(22); // pushed flush to the solid's new right edge (16+16-... )
  });

  it('squishes an actor against a wall', () => {
    const w = worldFrom([
      '.........#',
      '.........#',
      '.........#',
      '.........#',
      '##########',
    ]);
    const s = new Solid(w, 48, 16, 16, 8);
    w.solids.push(s);
    const a = new Actor(w);
    a.x = 64;
    a.y = 16;
    let squished = false;
    a.squish = () => (squished = true);
    s.move(16, 0, [a]); // pushes actor into the wall at x=72
    expect(squished).toBe(true);
  });
});
