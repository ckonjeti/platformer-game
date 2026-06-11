import { chapterArt } from '../../art';
import { drawTextCentered } from '../../art/font';
import { AmbientMotes, Fog } from '../../art/particles';
import { sfx } from '../../audio/sfx';
import { music } from '../../audio/music';
import type { Input } from '../../engine/input';
import { VIEW_H, VIEW_W, type Renderer } from '../../engine/renderer';
import type { Scene } from '../../engine/scene';
import type { Game } from '../context';
import { ChapterSelectScene } from './chapterSelect';

export class TitleScene implements Scene {
  private t = 0;
  private fog = new Fog(chapterArt(1).pal);
  private motes = new AmbientMotes(chapterArt(3).pal);

  constructor(private game: Game) {}

  enter(): void {
    music.play(1);
  }

  update(input: Input): void {
    this.t++;
    this.fog.update();
    this.motes.update();
    if (input.isPressed('confirm') || input.isPressed('jump')) {
      sfx.menuSelect();
      this.game.sm.replace(new ChapterSelectScene(this.game));
    }
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const art = chapterArt(1);
    ctx.drawImage(art.bg.sky, 0, 0);
    ctx.drawImage(art.bg.far, 0, 0);
    ctx.drawImage(art.bg.near, -60, 10);
    this.motes.draw(ctx);

    // A faint beam over the title
    ctx.globalAlpha = 0.08 + Math.sin(this.t * 0.02) * 0.03;
    ctx.fillStyle = art.pal.accent;
    ctx.fillRect(VIEW_W / 2 - 24, 0, 48, VIEW_H);
    ctx.globalAlpha = 1;

    drawTextCentered(ctx, 'LUMEN', VIEW_W / 2, 52, '#e8edf7', 5);
    drawTextCentered(ctx, 'A JOURNEY INWARD', VIEW_W / 2, 92, art.pal.accent, 1);

    if (this.t % 90 < 60) {
      drawTextCentered(ctx, 'PRESS JUMP', VIEW_W / 2, 136, art.pal.textColor, 1);
    }
    this.fog.draw(ctx);
  }
}
