import { chapterArt } from '../../art';
import { drawText, drawTextCentered } from '../../art/font';
import { sfx } from '../../audio/sfx';
import type { Input } from '../../engine/input';
import { VIEW_W, type Renderer } from '../../engine/renderer';
import type { Scene } from '../../engine/scene';
import { CHAPTERS, totalMotes } from '../../levels';
import type { Game } from '../context';
import { ChapterCardScene } from './chapterCard';
import { TitleScene } from './title';

export class ChapterSelectScene implements Scene {
  private cursor = 0;
  private t = 0;

  constructor(private game: Game) {
    this.cursor = Math.min(this.game.save.chapterUnlocked, CHAPTERS.length) - 1;
  }

  update(input: Input): void {
    this.t++;
    const unlocked = this.game.save.chapterUnlocked;
    if (input.isPressed('down')) {
      this.cursor = Math.min(this.cursor + 1, CHAPTERS.length - 1);
      sfx.menuMove();
    }
    if (input.isPressed('up')) {
      this.cursor = Math.max(this.cursor - 1, 0);
      sfx.menuMove();
    }
    if (input.isPressed('confirm') || input.isPressed('jump')) {
      if (this.cursor + 1 <= unlocked) {
        sfx.menuSelect();
        this.game.sm.replace(new ChapterCardScene(this.game, this.cursor + 1));
      }
    }
    if (input.isPressed('back')) {
      this.game.sm.replace(new TitleScene(this.game));
    }
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const art = chapterArt(Math.min(this.cursor + 1, 5));
    ctx.drawImage(art.bg.sky, 0, 0);
    ctx.drawImage(art.bg.far, 0, 0);

    drawTextCentered(ctx, 'THE PATH', VIEW_W / 2, 14, '#e8edf7', 2);

    const unlocked = this.game.save.chapterUnlocked;
    CHAPTERS.forEach((ch, i) => {
      const y = 42 + i * 18;
      const isLocked = i + 1 > unlocked;
      const selected = i === this.cursor;
      const color = isLocked ? '#4a5468' : selected ? '#ffffff' : art.pal.textColor;
      if (selected) {
        drawText(ctx, '>', 78, y, art.pal.accent);
      }
      const label = isLocked ? `${i + 1}  ?????` : `${i + 1}  ${ch.name.toUpperCase()}`;
      drawText(ctx, label, 90, y, color);
      if (this.game.save.completedChapters.includes(i + 1)) {
        drawText(ctx, '+', 230, y, art.pal.accent);
      }
    });

    const motes = this.game.save.motes.length;
    drawTextCentered(
      ctx,
      `LIGHT ${motes}/${totalMotes()}   FALLS ${this.game.save.deaths}`,
      VIEW_W / 2,
      152,
      art.pal.textColor,
    );
    drawTextCentered(ctx, 'JUMP TO BEGIN', VIEW_W / 2, 166, '#4a5468');
  }
}
