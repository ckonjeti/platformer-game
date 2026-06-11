/** Lazy WebAudio context + tiny synth helpers. Created on first user gesture. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

export function suspendAudio(): void {
  void ctx?.suspend();
}

export function resumeAudio(): void {
  void ctx?.resume();
}

export function audioContext(): AudioContext | null {
  return ctx;
}

export function masterGain(): GainNode | null {
  return master;
}

export interface ToneOpts {
  freq: number;
  endFreq?: number;
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  volume?: number;
  delay?: number;
}

export function tone(opts: ToneOpts): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const attack = opts.attack ?? 0.005;
  const decay = opts.decay ?? 0.15;
  const vol = opts.volume ?? 0.3;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), t0 + attack + decay);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

export interface NoiseOpts {
  decay?: number;
  volume?: number;
  filterFreq?: number;
  filterEnd?: number;
  delay?: number;
}

export function noise(opts: NoiseOpts = {}): void {
  if (!ctx || !master || !noiseBuffer) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const decay = opts.decay ?? 0.2;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(opts.filterFreq ?? 1200, t0);
  if (opts.filterEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterEnd), t0 + decay);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.volume ?? 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + decay + 0.05);
}
