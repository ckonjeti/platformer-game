import { audioContext, masterGain } from './synth';

/**
 * Per-chapter ambient music: a slow pentatonic pad loop.
 * Later chapters sit higher, brighter, and a little faster.
 */

// A minor pentatonic base, transposed up per chapter
const SCALE = [220, 261.63, 293.66, 329.63, 392];

interface ChapterMood {
  transpose: number;
  noteLen: number;
  filter: number;
  volume: number;
}

const MOODS: ChapterMood[] = [
  { transpose: 0.5, noteLen: 2.4, filter: 500, volume: 0.07 },
  { transpose: 0.5, noteLen: 2.2, filter: 700, volume: 0.07 },
  { transpose: 1, noteLen: 2.0, filter: 1100, volume: 0.08 },
  { transpose: 1, noteLen: 1.8, filter: 1800, volume: 0.08 },
  { transpose: 2, noteLen: 1.6, filter: 3200, volume: 0.09 },
];

class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private chapter = 0;
  private step = 0;

  play(chapter: number): void {
    if (this.chapter === chapter && this.timer) return;
    this.stop();
    this.chapter = chapter;
    const mood = MOODS[Math.min(Math.max(chapter, 1), 5) - 1]!;
    this.step = 0;
    const tick = () => this.note(mood);
    tick();
    this.timer = setInterval(tick, mood.noteLen * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.chapter = 0;
  }

  private note(mood: ChapterMood): void {
    const ctx = audioContext();
    const master = masterGain();
    if (!ctx || !master || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.02;
    const pattern = [0, 2, 4, 3, 1, 4, 2, 0];
    const base = SCALE[pattern[this.step % pattern.length]!]! * mood.transpose;
    this.step++;
    const dur = mood.noteLen * 1.6;
    for (const [mult, vol] of [[1, 1], [2, 0.35], [1.5, 0.25]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = base * mult;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = mood.filter;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(mood.volume * vol, t0 + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(f).connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    }
  }
}

export const music = new Music();
