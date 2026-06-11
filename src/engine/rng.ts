/** Mulberry32 seeded PRNG for deterministic effects. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Global non-deterministic convenience rng. */
export const rng = makeRng(Date.now() & 0xffffffff);

export function rand(min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
