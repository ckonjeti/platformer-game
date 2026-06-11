import { chapterArt } from '../../art';
import { drawTextCentered } from '../../art/font';
import type { Input } from '../../engine/input';
import { VIEW_H, VIEW_W, type Renderer } from '../../engine/renderer';
import type { Scene } from '../../engine/scene';
import { CHAPTERS } from '../../levels';
import type { Game } from '../context';
import { GameplayScene } from './gameplay';

const CARD_TIME = 170;

export class ChapterCardScene implements Scene {
  private t = 0;

  constructor(
    private game: Game,
    private chapter: number,
  ) {}

  update(input: Input): void {
    this.t++;
    if (this.t > CARD_TIME || (this.t > 30 && (input.isPressed('jump') || input.isPressed('confirm')))) {
      this.game.sm.replace(new GameplayScene(this.game, this.chapter));
    }
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const art = chapterArt(this.chapter);
    const def = CHAPTERS[this.chapter - 1]!;
    ctx.fillStyle = art.pal.bgTop;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    let a = 1;
    if (this.t < 25) a = this.t / 25;
    if (this.t > CARD_TIME - 25) a = (CARD_TIME - this.t) / 25;
    ctx.globalAlpha = Math.max(0, a);
    drawTextCentered(ctx, `CHAPTER ${this.chapter}`, VIEW_W / 2, 62, art.pal.accent);
    drawTextCentered(ctx, def.name.toUpperCase(), VIEW_W / 2, 78, '#ffffff', 2);
    drawTextCentered(ctx, def.epigraph.toUpperCase(), VIEW_W / 2, 108, art.pal.textColor);
    ctx.globalAlpha = 1;
  }
}
