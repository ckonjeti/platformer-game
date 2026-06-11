import { noise, tone } from './synth';

export const sfx = {
  jump(): void {
    tone({ freq: 240, endFreq: 480, type: 'square', decay: 0.12, volume: 0.16 });
  },
  wallJump(): void {
    tone({ freq: 200, endFreq: 420, type: 'square', decay: 0.1, volume: 0.15 });
    noise({ decay: 0.06, volume: 0.06, filterFreq: 2200 });
  },
  dash(): void {
    noise({ decay: 0.16, volume: 0.22, filterFreq: 3600, filterEnd: 300 });
    tone({ freq: 700, endFreq: 140, type: 'sawtooth', decay: 0.14, volume: 0.1 });
  },
  land(): void {
    noise({ decay: 0.07, volume: 0.1, filterFreq: 600 });
  },
  death(): void {
    tone({ freq: 480, endFreq: 60, type: 'sawtooth', decay: 0.4, volume: 0.2 });
    noise({ decay: 0.3, volume: 0.18, filterFreq: 2000, filterEnd: 100 });
  },
  respawn(): void {
    tone({ freq: 300, endFreq: 600, type: 'triangle', decay: 0.2, volume: 0.12 });
  },
  mote(): void {
    tone({ freq: 880, type: 'sine', decay: 0.25, volume: 0.16 });
    tone({ freq: 1320, type: 'sine', decay: 0.3, volume: 0.12, delay: 0.06 });
  },
  spring(): void {
    tone({ freq: 220, endFreq: 880, type: 'square', decay: 0.18, volume: 0.16 });
  },
  crystal(): void {
    tone({ freq: 660, type: 'triangle', decay: 0.12, volume: 0.16 });
    tone({ freq: 990, type: 'triangle', decay: 0.16, volume: 0.12, delay: 0.04 });
  },
  crumble(): void {
    noise({ decay: 0.25, volume: 0.14, filterFreq: 900, filterEnd: 200 });
  },
  dreamEnter(): void {
    tone({ freq: 330, endFreq: 660, type: 'sine', decay: 0.3, volume: 0.16 });
  },
  dreamExit(): void {
    tone({ freq: 660, endFreq: 330, type: 'sine', decay: 0.25, volume: 0.14 });
  },
  climb(): void {
    noise({ decay: 0.05, volume: 0.05, filterFreq: 1500 });
  },
  menuMove(): void {
    tone({ freq: 440, type: 'square', decay: 0.05, volume: 0.08 });
  },
  menuSelect(): void {
    tone({ freq: 520, endFreq: 780, type: 'square', decay: 0.12, volume: 0.12 });
  },
  text(): void {
    tone({ freq: 600, type: 'sine', decay: 0.4, volume: 0.08 });
  },
  chapterComplete(): void {
    const notes = [392, 494, 587, 784];
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', decay: 0.35, volume: 0.14, delay: i * 0.12 }));
  },
};
