/** Render palette-indexed pixel strings to a canvas. '.' = transparent; 0-9a-f index the palette. */
export type Palette = (string | null)[];

export function spriteFromStrings(palette: Palette, rows: string[]): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const idx = parseInt(ch, 16);
      const color = palette[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

export interface Anim {
  frames: HTMLCanvasElement[];
  /** Frames (60ths of a second) each animation frame is shown. */
  rate: number;
  loop: boolean;
}

export class Animator {
  private t = 0;
  private index = 0;
  anim: Anim;

  constructor(anim: Anim) {
    this.anim = anim;
  }

  play(anim: Anim): void {
    if (this.anim === anim) return;
    this.anim = anim;
    this.t = 0;
    this.index = 0;
  }

  update(): void {
    this.t++;
    if (this.t >= this.anim.rate) {
      this.t = 0;
      if (this.index + 1 < this.anim.frames.length) this.index++;
      else if (this.anim.loop) this.index = 0;
    }
  }

  get frame(): HTMLCanvasElement {
    return this.anim.frames[this.index]!;
  }
}
