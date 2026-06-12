import { chapterArt, type ChapterArt } from '../../art';
import { drawTextCentered } from '../../art/font';
import { AmbientMotes, Fog, Particles } from '../../art/particles';
import { Animator } from '../../art/pixel';
import { sfx } from '../../audio/sfx';
import { music } from '../../audio/music';
import type { Input } from '../../engine/input';
import { T_SEMI, T_SOLID, TILE } from '../../engine/physics';
import { VIEW_H, VIEW_W, type Renderer } from '../../engine/renderer';
import { randInt } from '../../engine/rng';
import type { Scene } from '../../engine/scene';
import { CHAPTERS, findScreen } from '../../levels';
import { SCREEN_COLS, SCREEN_ROWS } from '../../levels/legend';
import * as C from '../constants';
import type { Game } from '../context';
import { spawnEntities, spikesKill, type RoomEntities } from '../entities';
import { parseScreen, type ParsedScreen } from '../level';
import { Player } from '../player';
import { PauseScene } from './pause';
import { ChapterCardScene } from './chapterCard';
import { EndingScene } from './ending';

type ExitDir = 'left' | 'right' | 'up' | 'down';

interface Ghost {
  frame: HTMLCanvasElement;
  x: number;
  y: number;
  life: number;
}

const ROOM_H = SCREEN_ROWS * TILE; // 184: bottom 4px extend past the 180px view

export class GameplayScene implements Scene {
  private art: ChapterArt;
  private parsed!: ParsedScreen;
  private ents!: RoomEntities;
  private player!: Player;
  private animator: Animator;
  private particles = new Particles();
  private fog: Fog;
  private ambient: AmbientMotes;
  private terrainCache = new Map<string, HTMLCanvasElement>();

  private mode: 'play' | 'transition' | 'complete' = 'play';
  private freezeT = 0;
  private deadT = 0;
  private respawnT = 0;
  private shakeT = 0;
  private shakeMag = 0;
  private completeT = 0;

  private transitionT = 0;
  private transitionDir: ExitDir = 'right';
  private lastFrame: HTMLCanvasElement;

  private ghosts: Ghost[] = [];
  private activeText: { line: string; t: number } | null = null;
  private firedTexts = new Set<string>();
  private screenIndex = 0;
  private frame = 0;

  constructor(
    private game: Game,
    public chapter: number,
    startScreen?: string,
  ) {
    this.art = chapterArt(chapter);
    this.fog = new Fog(this.art.pal);
    this.ambient = new AmbientMotes(this.art.pal);
    this.animator = new Animator(this.art.player.right.idle);
    this.lastFrame = document.createElement('canvas');
    this.lastFrame.width = VIEW_W;
    this.lastFrame.height = VIEW_H;
    const chapterDef = CHAPTERS[chapter - 1]!;
    const first = startScreen ?? chapterDef.screens[0]!.id;
    this.loadScreen(first);
    this.player.spawnAt(this.parsed.spawn.x, this.parsed.spawn.y);
    music.play(chapter);
    this.installDebugHook();
  }

  // ------------------------------------------------------------- room mgmt

  private loadScreen(id: string): void {
    const def = findScreen(id);
    if (!def) throw new Error(`unknown screen ${id}`);
    this.parsed = parseScreen(def);
    this.ents = spawnEntities(this.parsed, new Set(this.game.save.motes));
    const keepPlayer = this.player;
    this.player = new Player(this.parsed.world);
    if (keepPlayer) {
      this.player.x = keepPlayer.x;
      this.player.y = keepPlayer.y;
      this.player.vx = keepPlayer.vx;
      this.player.vy = keepPlayer.vy;
      this.player.facing = keepPlayer.facing;
      this.player.dashes = keepPlayer.dashes;
      this.player.stamina = keepPlayer.stamina;
    }
    this.wirePlayerEvents();
    this.screenIndex = CHAPTERS[this.chapter - 1]!.screens.findIndex((s) => s.id === id);
    this.game.save.reached[this.chapter] = id;
    this.game.persist();
  }

  private wirePlayerEvents(): void {
    const pal = this.art.pal;
    this.player.events = {
      onJump: () => sfx.jump(),
      onWallJump: () => {
        sfx.wallJump();
        this.particles.dust(this.player.x + 4, this.player.y + 6, pal.accent);
      },
      onDash: () => {
        sfx.dash();
        this.shake(4, 2);
      },
      onLand: () => {
        sfx.land();
        this.particles.dust(this.player.x + 4, this.player.y + this.player.h, pal.terrainEdge);
      },
      onDeath: () => {
        sfx.death();
        this.shake(10, 3);
        this.particles.deathBurst(this.player.x + 4, this.player.y + 5, pal.accent);
        this.game.save.deaths++;
        this.game.persist();
        this.deadT = C.DEATH_TIME;
      },
      onDreamEnter: () => sfx.dreamEnter(),
      onDreamExit: () => sfx.dreamExit(),
    };
  }

  private respawn(): void {
    // Fully rebuild the room so crumbles/crystals reset
    this.loadScreen(this.parsed.def.id);
    this.player.spawnAt(this.parsed.spawn.x, this.parsed.spawn.y);
    this.respawnT = C.RESPAWN_TIME;
    this.ghosts = [];
    sfx.respawn();
  }

  private shake(frames: number, mag: number): void {
    this.shakeT = Math.max(this.shakeT, frames);
    this.shakeMag = mag;
  }

  // ------------------------------------------------------------- update

  update(input: Input): void {
    this.frame++;
    this.fog.update();
    this.ambient.update();

    if (this.mode === 'transition') {
      this.particles.update();
      if (--this.transitionT <= 0) this.mode = 'play';
      return;
    }

    if (this.mode === 'complete') {
      this.particles.update();
      this.completeT++;
      if (this.completeT > 100) {
        if (this.chapter < CHAPTERS.length) {
          this.game.sm.replace(new ChapterCardScene(this.game, this.chapter + 1));
        } else {
          this.game.sm.replace(new EndingScene(this.game));
        }
      }
      return;
    }

    if (input.isPressed('pause')) {
      this.game.sm.push(new PauseScene(this.game, this));
      return;
    }

    if (this.freezeT > 0) {
      this.freezeT--;
      return;
    }

    this.particles.update();
    if (this.shakeT > 0) this.shakeT--;

    // Death flow
    if (this.player.dead) {
      if (this.deadT > 0 && --this.deadT === 0) this.respawn();
      return;
    }
    if (this.respawnT > 0) this.respawnT--;

    // Entities first (platforms may carry the player)
    this.ents.wind.update(this.player, this.particles, this.art.pal.accent);
    for (const p of this.ents.platforms) p.update([this.player]);
    for (const c of this.ents.crumbles) c.update(this.player);

    this.player.update({
      moveX: input.moveX,
      moveY: input.moveY,
      jumpHeld: input.isHeld('jump'),
      jumpPressed: input.isPressed('jump'),
      dashPressed: input.isPressed('dash'),
      grabHeld: input.isHeld('grab'),
    });

    if (this.player.freezeRequest > 0) {
      this.freezeT += this.player.freezeRequest;
      this.player.freezeRequest = 0;
    }

    // Dash ghost trail
    if ((this.player.state === 'dash' || this.player.state === 'dream') && this.frame % 2 === 0) {
      this.ghosts.push({
        frame: this.animator.frame,
        x: this.player.x,
        y: this.player.y,
        life: 12,
      });
    }
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);

    for (const s of this.ents.springs) s.update(this.player, this.particles, this.art.pal.accent);
    for (const c of this.ents.crystals) c.update(this.player, this.particles, this.art.pal.accent);
    for (const m of this.ents.motes) {
      m.update(this.player, this.particles, this.art.pal.accent, (id) => {
        this.game.save.motes.push(id);
        this.game.persist();
      });
    }

    // Hazards
    if (spikesKill(this.player, this.parsed.spikes)) this.player.die();
    if (this.player.y > ROOM_H + 16 && !this.parsed.def.exits.down) this.player.die();

    // Narrative text triggers
    for (const t of this.parsed.texts) {
      const key = `${this.parsed.def.id}:${t.tx},${t.ty}`;
      if (this.firedTexts.has(key)) continue;
      const dx = Math.abs(this.player.x - t.x);
      const dy = Math.abs(this.player.y - t.y);
      if (dx < 14 && dy < 20) {
        this.firedTexts.add(key);
        const index = this.parsed.texts.indexOf(t);
        const line = this.parsed.def.texts?.[index];
        if (line) {
          this.activeText = { line, t: 0 };
          sfx.text();
        }
      }
    }
    if (this.activeText && ++this.activeText.t > 240) this.activeText = null;

    // Finale trigger
    if (this.parsed.finale) {
      const f = this.parsed.finale;
      const dx = Math.abs(this.player.x + 4 - (f.x + 4));
      const dy = Math.abs(this.player.y + 5 - (f.y + 4));
      if (dx < 10 && dy < 14) this.completeChapter();
    }

    // Room exits
    this.checkExits();

    // Animation
    const anims = (this.player.dashes === 0 ? this.art.playerSpent : this.art.player)[
      this.player.facing > 0 ? 'right' : 'left'
    ];
    const key = this.player.animState as keyof typeof anims;
    this.animator.play(anims[key] ?? anims.idle);
    this.animator.update();
  }

  private completeChapter(): void {
    if (this.mode === 'complete') return;
    this.mode = 'complete';
    this.completeT = 0;
    sfx.chapterComplete();
    const save = this.game.save;
    if (!save.completedChapters.includes(this.chapter)) save.completedChapters.push(this.chapter);
    save.chapterUnlocked = Math.max(save.chapterUnlocked, Math.min(this.chapter + 1, CHAPTERS.length));
    if (this.chapter === CHAPTERS.length) save.finished = true;
    this.game.persist();
  }

  private checkExits(): void {
    const exits = this.parsed.def.exits;
    const p = this.player;
    // Vertical exits also require matching velocity, so an arrival placed at
    // the seam edge can't instantly bounce back through the seam it came from.
    if (exits.right && p.x >= SCREEN_COLS * TILE - 4) {
      this.startTransition('right', exits.right);
    } else if (exits.left && p.x <= -4) {
      this.startTransition('left', exits.left);
    } else if (exits.up && p.y + p.h <= 2 && p.vy < 0) {
      this.startTransition('up', exits.up);
    } else if (exits.down && p.y >= ROOM_H - 2 && p.vy > 0) {
      this.startTransition('down', exits.down);
    } else {
      // Clamp at closed side edges
      if (!exits.left && p.x < 0) p.x = 0;
      if (!exits.right && p.x > SCREEN_COLS * TILE - p.w) p.x = SCREEN_COLS * TILE - p.w;
      if (!exits.up && p.y < -8) p.y = -8;
    }
  }

  private startTransition(dir: ExitDir, nextId: string): void {
    const keep = this.player;
    this.loadScreen(nextId);
    const p = this.player;
    switch (dir) {
      case 'right':
        p.x = 1;
        p.y = keep.y;
        break;
      case 'left':
        p.x = SCREEN_COLS * TILE - p.w - 1;
        p.y = keep.y;
        break;
      case 'up':
        p.y = ROOM_H - p.h - 2;
        p.x = keep.x;
        // Preserve upward momentum through the seam
        p.vy = Math.min(keep.vy, -2);
        break;
      case 'down':
        p.y = -p.h + 2;
        p.x = keep.x;
        break;
    }
    // Ground heights can differ across a seam: pop the player up out of
    // any solid so a sideways entry never embeds them in the floor.
    if (dir === 'right' || dir === 'left') {
      for (let i = 0; i < 32 && p.world.solidAt(p); i++) p.y--;
    }
    this.mode = 'transition';
    this.transitionDir = dir;
    this.transitionT = C.TRANSITION_TIME;
    this.ghosts = [];
    this.particles.clear();
  }

  // ------------------------------------------------------------- draw

  draw(r: Renderer): void {
    const ctx = r.ctx;
    this.drawBackdrop(ctx);

    let ox = 0;
    let oy = 0;
    if (this.shakeT > 0) {
      ox = randInt(-this.shakeMag, this.shakeMag);
      oy = randInt(-this.shakeMag, this.shakeMag);
    }

    if (this.mode === 'transition') {
      const t = this.transitionT / C.TRANSITION_TIME; // 1 → 0
      const ease = t * t;
      let dx = 0;
      let dy = 0;
      if (this.transitionDir === 'right') dx = VIEW_W * ease;
      if (this.transitionDir === 'left') dx = -VIEW_W * ease;
      if (this.transitionDir === 'up') dy = -VIEW_H * ease;
      if (this.transitionDir === 'down') dy = VIEW_H * ease;
      // Old frame slides out
      ctx.drawImage(this.lastFrame, Math.round(dx - Math.sign(dx) * VIEW_W), Math.round(dy - Math.sign(dy) * VIEW_H));
      ctx.save();
      ctx.translate(Math.round(dx), Math.round(dy));
      this.drawRoom(ctx);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(ox, oy);
      this.drawRoom(ctx);
      ctx.restore();
      // Keep a copy for the next transition
      const lf = this.lastFrame.getContext('2d')!;
      lf.clearRect(0, 0, VIEW_W, VIEW_H);
      lf.drawImage(r.canvas, 0, 0);
    }

    this.fog.draw(ctx);
    this.drawHud(ctx);

    if (this.mode === 'complete') {
      const a = Math.min(1, this.completeT / 80);
      ctx.fillStyle = '#fffbe8';
      ctx.globalAlpha = a;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const bg = this.art.bg;
    ctx.drawImage(bg.sky, 0, 0);
    // Slow per-screen parallax offset so rooms feel distinct
    const sx = (this.screenIndex * 37) % 160;
    ctx.drawImage(bg.far, -sx, 0);
    ctx.drawImage(bg.far, 480 - sx, 0);
    ctx.drawImage(bg.near, -sx * 2 - 40, 0);
    ctx.drawImage(bg.near, 480 - sx * 2 - 40, 0);
    if (bg.rays) ctx.drawImage(bg.rays, 0, 0);
    this.ambient.draw(ctx);
  }

  private drawRoom(ctx: CanvasRenderingContext2D): void {
    // Dream blocks behind terrain
    const inDream = this.player.state === 'dream';
    for (const d of this.ents.dreams) d.draw(ctx, this.art, inDream);

    ctx.drawImage(this.terrainCanvas(), 0, 0);

    for (const p of this.ents.platforms) p.draw(ctx, this.art);
    for (const c of this.ents.crumbles) c.draw(ctx, this.art, this.frame);
    for (const s of this.ents.springs) s.draw(ctx, this.art);
    for (const c of this.ents.crystals) c.draw(ctx, this.art);
    for (const m of this.ents.motes) m.draw(ctx, this.art);
    this.drawFinale(ctx);

    // Dash ghosts
    for (const g of this.ghosts) {
      ctx.globalAlpha = (g.life / 12) * 0.45;
      ctx.drawImage(g.frame, g.x - 4, g.y + this.player.h - 16);
    }
    ctx.globalAlpha = 1;

    this.drawPlayer(ctx);
    this.particles.draw(ctx);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    if (p.dead) return;
    // Respawn blink
    if (this.respawnT > 0 && this.respawnT % 4 < 2) return;
    // Low stamina warning blink
    if (p.lowStamina && this.frame % 8 < 3) {
      ctx.globalAlpha = 0.5;
    }
    if (this.art.aura) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.art.aura, p.x + 4 - this.art.aura.width / 2, p.y + 5 - this.art.aura.height / 2);
      ctx.globalCompositeOperation = prev;
    }
    ctx.drawImage(this.animator.frame, p.x - 4, p.y + p.h - 16);
    ctx.globalAlpha = 1;
  }

  private drawFinale(ctx: CanvasRenderingContext2D): void {
    const f = this.parsed.finale;
    if (!f) return;
    const t = this.frame;
    const cx = f.x + 4;
    // A quiet beam of light
    ctx.globalAlpha = 0.12 + Math.sin(t * 0.04) * 0.05;
    ctx.fillStyle = this.art.pal.accent;
    ctx.fillRect(cx - 5, 0, 10, f.y + 8);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(cx - 2, 0, 4, f.y + 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    const pulse = Math.floor(t / 20) % 2;
    ctx.fillRect(cx - 1, f.y + 2 - pulse, 2, 2);
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    // Mote count, top right
    const count = this.game.save.motes.length;
    if (count > 0) {
      ctx.drawImage(this.art.mote[0]!, VIEW_W - 26, 5);
      drawTextCentered(ctx, `${count}`, VIEW_W - 12, 5, this.art.pal.textColor);
    }
    // Narrative line
    if (this.activeText) {
      const { line, t } = this.activeText;
      let a = 1;
      if (t < 30) a = t / 30;
      if (t > 200) a = Math.max(0, (240 - t) / 40);
      ctx.globalAlpha = a;
      drawTextCentered(ctx, line, VIEW_W / 2, 24, this.art.pal.textColor);
      ctx.globalAlpha = 1;
    }
  }

  private terrainCanvas(): HTMLCanvasElement {
    const id = this.parsed.def.id;
    const hit = this.terrainCache.get(id);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = SCREEN_COLS * TILE;
    c.height = SCREEN_ROWS * TILE;
    const ctx = c.getContext('2d')!;
    const w = this.parsed.world;
    for (let ty = 0; ty < SCREEN_ROWS; ty++) {
      for (let tx = 0; tx < SCREEN_COLS; tx++) {
        const t = w.tileAt(tx, ty);
        if (t === T_SOLID) {
          let mask = 0;
          if (w.tileAt(tx, ty - 1) === T_SOLID) mask |= 1;
          if (w.tileAt(tx + 1, ty) === T_SOLID) mask |= 2;
          if (w.tileAt(tx, ty + 1) === T_SOLID) mask |= 4;
          if (w.tileAt(tx - 1, ty) === T_SOLID) mask |= 8;
          ctx.drawImage(this.art.terrain[mask]!, tx * TILE, ty * TILE);
        } else if (t === T_SEMI) {
          ctx.drawImage(this.art.semi, tx * TILE, ty * TILE);
        }
      }
    }
    // Static spikes baked into the room canvas
    for (const s of this.parsed.spikes) {
      ctx.drawImage(this.art.spikes[s.dir], s.tx * TILE, s.ty * TILE);
    }
    this.terrainCache.set(id, c);
    return c;
  }

  // ------------------------------------------------------------- debug

  restartScreen(): void {
    this.player.die();
  }

  private installDebugHook(): void {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __game?: unknown };
    w.__game = {
      scene: 'gameplay',
      get chapter() {
        return self.chapter;
      },
      get screen() {
        return self.parsed.def.id;
      },
      get player() {
        return { x: self.player.x, y: self.player.y, state: self.player.state, dashes: self.player.dashes };
      },
      get deaths() {
        return self.game.save.deaths;
      },
      warp(id: string) {
        self.loadScreen(id);
        self.player.spawnAt(self.parsed.spawn.x, self.parsed.spawn.y);
      },
    };
    const self = this;
  }
}
