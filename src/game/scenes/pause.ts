import { drawTextCentered } from '../../art/font';
import { sfx } from '../../audio/sfx';
import type { Input } from '../../engine/input';
import { VIEW_H, VIEW_W, type Renderer } from '../../engine/renderer';
import type { Scene } from '../../engine/scene';
import type { Game } from '../context';
import type { GameplayScene } from './gameplay';
import { ChapterSelectScene } from './chapterSelect';

const OPTIONS = ['CONTINUE', 'RETRY SCREEN', 'THE PATH'] as const;

export class PauseScene implements Scene {
  private cursor = 0;

  constructor(
    private game: Game,
    private gameplay: GameplayScene,
  ) {}

  update(input: Input): void {
    if (input.isPressed('down')) {
      this.cursor = (this.cursor + 1) % OPTIONS.length;
      sfx.menuMove();
    }
    if (input.isPressed('up')) {
      this.cursor = (this.cursor + OPTIONS.length - 1) % OPTIONS.length;
      sfx.menuMove();
    }
    if (input.isPressed('pause') || input.isPressed('back')) {
      this.game.sm.pop();
      return;
    }
    if (input.isPressed('confirm') || input.isPressed('jump')) {
      sfx.menuSelect();
      switch (OPTIONS[this.cursor]) {
        case 'CONTINUE':
          this.game.sm.pop();
          break;
        case 'RETRY SCREEN':
          this.game.sm.pop();
          this.gameplay.restartScreen();
          break;
        case 'THE PATH':
          this.game.sm.replace(new ChapterSelectScene(this.game));
          break;
      }
    }
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    drawTextCentered(ctx, 'PAUSED', VIEW_W / 2, 50, '#ffffff', 2);
    OPTIONS.forEach((opt, i) => {
      const selected = i === this.cursor;
      drawTextCentered(ctx, (selected ? '> ' : '') + opt, VIEW_W / 2, 84 + i * 14, selected ? '#ffffff' : '#8a93a8');
    });
  }
}
