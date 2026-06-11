import { overlaps, Solid, TILE, World, type Rect } from '../engine/physics';
import type { ChapterArt } from '../art';
import type { Particles } from '../art/particles';
import { sfx } from '../audio/sfx';
import * as C from './constants';
import type { ParsedScreen, PointSpawn, SpikeSpawn } from './level';
import type { Player } from './player';

// ----------------------------------------------------------------- springs

export class Spring {
  private anim = 0;

  constructor(public spawn: PointSpawn) {}

  get hitbox(): Rect {
    return { x: this.spawn.x, y: this.spawn.y + 2, w: TILE, h: TILE - 2 };
  }

  update(player: Player, particles: Particles, accent: string): void {
    if (this.anim > 0) this.anim--;
    if (!player.dead && player.vy >= 0 && overlaps(player, this.hitbox)) {
      player.bounce(C.SPRING_SPEED);
      this.anim = 14;
      sfx.spring();
      particles.springBounce(this.spawn.x + 4, this.spawn.y + 4, accent);
    }
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt): void {
    const frame = this.anim > 0 ? art.spring[1]! : art.spring[0]!;
    ctx.drawImage(frame, this.spawn.x, this.spawn.y);
  }
}

// ----------------------------------------------------------------- crystals

export class Crystal {
  active = true;
  private respawn = 0;
  private t = Math.random() * 100;

  constructor(public spawn: PointSpawn) {}

  get hitbox(): Rect {
    return { x: this.spawn.x - 1, y: this.spawn.y - 1, w: 10, h: 10 };
  }

  update(player: Player, particles: Particles, accent: string): void {
    this.t++;
    if (!this.active) {
      if (--this.respawn <= 0) this.active = true;
      return;
    }
    if (!player.dead && overlaps(player, this.hitbox)) {
      const usedDash = player.refillDash();
      const usedStamina = player.stamina < C.MAX_STAMINA;
      if (usedDash || usedStamina) {
        player.refillStamina();
        this.active = false;
        this.respawn = C.CRYSTAL_RESPAWN_TIME;
        sfx.crystal();
        particles.sparkle(this.spawn.x + 4, this.spawn.y + 4, accent);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt): void {
    const bob = Math.round(Math.sin(this.t * 0.05) * 1.5);
    if (this.active) {
      const frame = Math.floor(this.t / 20) % 2;
      ctx.drawImage(art.crystal[frame]!, this.spawn.x, this.spawn.y + bob);
    } else {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(art.crystal[1]!, this.spawn.x, this.spawn.y + bob);
      ctx.globalAlpha = 1;
    }
  }
}

// ----------------------------------------------------------------- motes

export class Mote {
  collected = false;
  private t = Math.random() * 100;

  constructor(
    public spawn: PointSpawn,
    public id: string,
  ) {}

  get hitbox(): Rect {
    return { x: this.spawn.x, y: this.spawn.y, w: 6, h: 6 };
  }

  update(player: Player, particles: Particles, accent: string, onCollect: (id: string) => void): void {
    this.t++;
    if (this.collected || player.dead) return;
    if (overlaps(player, this.hitbox)) {
      this.collected = true;
      sfx.mote();
      particles.sparkle(this.spawn.x + 3, this.spawn.y + 3, accent);
      onCollect(this.id);
    }
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt): void {
    if (this.collected) return;
    const bob = Math.round(Math.sin(this.t * 0.06) * 2);
    const frame = Math.floor(this.t / 12) % art.mote.length;
    ctx.drawImage(art.mote[frame]!, this.spawn.x, this.spawn.y + bob);
  }
}

// ----------------------------------------------------------------- crumble

export class CrumbleBlock extends Solid {
  /** idle → shaking → gone → idle */
  state: 'idle' | 'shaking' | 'gone' = 'idle';
  private timer = 0;

  constructor(world: World, spawn: PointSpawn) {
    super(world, spawn.x, spawn.y, TILE, TILE);
  }

  update(player: Player): void {
    switch (this.state) {
      case 'idle': {
        const standing =
          player.y + player.h === this.y && player.x < this.x + this.w && player.x + player.w > this.x;
        const grabbing =
          player.state === 'climb' &&
          player.y < this.y + this.h &&
          player.y + player.h > this.y &&
          (player.x + player.w === this.x || player.x === this.x + this.w);
        if (!player.dead && (standing || grabbing)) {
          this.state = 'shaking';
          this.timer = C.CRUMBLE_SHAKE_TIME;
          sfx.crumble();
        }
        break;
      }
      case 'shaking':
        if (--this.timer <= 0) {
          this.state = 'gone';
          this.collidable = false;
          this.timer = C.CRUMBLE_GONE_TIME;
        }
        break;
      case 'gone':
        if (--this.timer <= 0 && !overlaps(this, player)) {
          this.state = 'idle';
          this.collidable = true;
        }
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt, frame: number): void {
    if (this.state === 'gone') return;
    let ox = 0;
    if (this.state === 'shaking') ox = frame % 4 < 2 ? 1 : -1;
    ctx.drawImage(art.crumble, this.x + ox, this.y);
  }
}

// ----------------------------------------------------------------- platform

export class MovingPlatform extends Solid {
  private t = 0;
  private dir = 1;
  private readonly from: PointSpawn;
  private readonly to: PointSpawn;
  private readonly travelFrames: number;

  constructor(world: World, from: PointSpawn, to: PointSpawn) {
    super(world, from.x, from.y, TILE * 3, TILE);
    this.from = from;
    this.to = to;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.travelFrames = Math.max(30, Math.round(dist / C.PLATFORM_SPEED));
  }

  update(actors: Player[]): void {
    this.t += this.dir;
    if (this.t >= this.travelFrames) this.dir = -1;
    if (this.t <= 0) this.dir = 1;
    // Ease in/out for a gentler ride
    const raw = this.t / this.travelFrames;
    const eased = raw * raw * (3 - 2 * raw);
    const targetX = this.from.x + (this.to.x - this.from.x) * eased;
    const targetY = this.from.y + (this.to.y - this.from.y) * eased;
    this.move(targetX - (this.x + this.remX), targetY - (this.y + this.remY), actors);
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt): void {
    ctx.fillStyle = art.pal.terrainDark;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = art.pal.terrainEdge;
    ctx.fillRect(this.x, this.y, this.w, 2);
    ctx.fillStyle = art.pal.accent;
    ctx.fillRect(this.x + 1, this.y + this.h - 2, 1, 1);
    ctx.fillRect(this.x + this.w - 2, this.y + this.h - 2, 1, 1);
  }
}

// ----------------------------------------------------------------- dream

export class DreamBlock extends Solid {
  private stars: { x: number; y: number; speed: number; shade: number }[] = [];

  constructor(world: World, rect: Rect) {
    super(world, rect.x, rect.y, rect.w, rect.h);
    this.dream = true;
    const count = Math.max(3, Math.floor((rect.w * rect.h) / 250));
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * rect.w,
        y: Math.random() * rect.h,
        speed: 0.05 + Math.random() * 0.15,
        shade: Math.floor(Math.random() * 3),
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, art: ChapterArt, playerInside: boolean): void {
    ctx.fillStyle = '#0b0b16';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    const colors = ['#5f6e96', art.pal.accent, '#ffffff'];
    for (const s of this.stars) {
      s.x += s.speed;
      if (s.x >= this.w - 1) s.x = 1;
      ctx.fillStyle = colors[s.shade]!;
      ctx.fillRect(this.x + Math.floor(s.x), this.y + Math.floor(s.y), 1, 1);
    }
    ctx.strokeStyle = playerInside ? '#ffffff' : art.pal.accent;
    ctx.globalAlpha = playerInside ? 0.9 : 0.6;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);
    ctx.globalAlpha = 1;
  }
}

// ----------------------------------------------------------------- wind

export class WindController {
  private t = 0;
  active = false;
  x = 0;
  y = 0;

  constructor(private def: { x: number; y: number; mode: 'steady' | 'gust' } | undefined) {
    this.active = !!def;
  }

  update(player: Player, particles: Particles, color: string): void {
    if (!this.def) {
      player.windX = 0;
      player.windY = 0;
      return;
    }
    this.t++;
    let strength = 1;
    if (this.def.mode === 'gust') {
      // ~2s on, ~1.4s off
      const phase = this.t % 204;
      if (phase > 120) strength = 0;
      else if (phase < 20) strength = phase / 20;
    }
    this.x = this.def.x * strength;
    this.y = this.def.y * strength;
    player.windX = player.dead ? 0 : this.x;
    player.windY = player.dead ? 0 : this.y;
    // Streaks so the wind is readable
    if (strength > 0.3 && this.t % 3 === 0) {
      const px = this.def.x !== 0 ? (this.def.x > 0 ? -4 : 324) : Math.random() * 320;
      const py = this.def.y !== 0 ? (this.def.y > 0 ? -4 : 184) : Math.random() * 180;
      particles.spawn(px, py, this.x * 5, this.y * 5, 70, 1, color);
    }
  }
}

// ----------------------------------------------------------------- spikes

export function spikesKill(player: Player, spikes: SpikeSpawn[]): boolean {
  if (player.dead) return false;
  for (const s of spikes) {
    if (!overlaps(player, s)) continue;
    const eff = player.state === 'dream' ? false : true;
    if (!eff) continue;
    switch (s.dir) {
      case 'up':
        if (player.vy >= 0) return true;
        break;
      case 'down':
        if (player.vy <= 0) return true;
        break;
      case 'left':
        if (player.vx + player.windX >= 0) return true;
        break;
      case 'right':
        if (player.vx + player.windX <= 0) return true;
        break;
    }
  }
  return false;
}

// ----------------------------------------------------------------- bundle

export interface RoomEntities {
  springs: Spring[];
  crystals: Crystal[];
  motes: Mote[];
  crumbles: CrumbleBlock[];
  platforms: MovingPlatform[];
  dreams: DreamBlock[];
  wind: WindController;
}

export function spawnEntities(parsed: ParsedScreen, collectedMotes: Set<string>): RoomEntities {
  const world = parsed.world;
  const ents: RoomEntities = {
    springs: parsed.springs.map((s) => new Spring(s)),
    crystals: parsed.crystals.map((s) => new Crystal(s)),
    motes: parsed.motes
      .map((s) => new Mote(s, `${parsed.def.id}:${s.tx},${s.ty}`))
      .filter((m) => !collectedMotes.has(m.id)),
    crumbles: parsed.crumbles.map((s) => new CrumbleBlock(world, s)),
    platforms: parsed.platforms.map((p) => new MovingPlatform(world, p.from, p.to)),
    dreams: parsed.dreamRects.map((r) => new DreamBlock(world, r)),
    wind: new WindController(parsed.def.wind),
  };
  world.solids.push(...ents.crumbles, ...ents.platforms, ...ents.dreams);
  return ents;
}
