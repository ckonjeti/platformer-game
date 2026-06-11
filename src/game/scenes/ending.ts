import { chapterArt } from '../../art';
import { drawTextCentered } from '../../art/font';
import { AmbientMotes } from '../../art/particles';
import { music } from '../../audio/music';
import type { Input } from '../../engine/input';
import { VIEW_W, type Renderer } from '../../engine/renderer';
import type { Scene } from '../../engine/scene';
import { totalMotes } from '../../levels';
import type { Game } from '../context';
import { TitleScene } from './title';

const LINES = [
  'THE FOG WAS NEVER OUTSIDE',
  'NOTHING WAS GAINED',
  'ONLY SEEN',
  '',
  'THE LIGHT WAS YOURS ALL ALONG',
];

export class EndingScene implements Scene {
  private t = 0;
  private motes = new AmbientMotes(chapterArt(5).pal);

  constructor(private game: Game) {}

  enter(): void {
    music.play(5);
  }

  update(input: Input): void {
    this.t++;
    this.motes.update();
    if (this.t > 60 * 14 || (this.t > 240 && (input.isPressed('jump') || input.isPressed('confirm')))) {
      this.game.sm.replace(new TitleScene(this.game));
    }
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const art = chapterArt(5);
    ctx.drawImage(art.bg.sky, 0, 0);
    if (art.bg.rays) ctx.drawImage(art.bg.rays, 0, 0);
    this.motes.draw(ctx);

    // The figure, unhooded, rising slowly in light
    const rise = Math.min(60, this.t * 0.08);
    const py = 120 - rise;
    if (art.aura) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(art.aura, VIEW_W / 2 - art.aura.width / 2, py - art.aura.height / 2 + 8);
      ctx.globalCompositeOperation = prev;
    }
    const frame = art.player.right.idle.frames[0]!;
    ctx.drawImage(frame, VIEW_W / 2 - 8, py);

    // Lines fade in one at a time
    LINES.forEach((line, i) => {
      const start = 120 + i * 110;
      if (this.t < start) return;
      const a = Math.min(1, (this.t - start) / 50);
      ctx.globalAlpha = a;
      drawTextCentered(ctx, line, VIEW_W / 2, 28 + i * 12, art.pal.textColor);
      ctx.globalAlpha = 1;
    });

    if (this.t > 120 + LINES.length * 110) {
      drawTextCentered(
        ctx,
        `LIGHT ${this.game.save.motes.length}/${totalMotes()}   FALLS ${this.game.save.deaths}`,
        VIEW_W / 2,
        140,
        art.pal.accent,
      );
      drawTextCentered(ctx, 'JUMP TO RETURN', VIEW_W / 2, 162, '#8a93a8');
    }
  }
}
