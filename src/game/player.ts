import { Actor, World, type Rect } from '../engine/physics';
import * as C from './constants';

/** Frame input snapshot — satisfied by engine Input, or built by tests. */
export interface PlayerInput {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
  grabHeld: boolean;
}

export type PlayerState = 'normal' | 'dash' | 'dream' | 'climb' | 'dead';

/** Gameplay events the scene wires to sfx/particles. All optional. */
export interface PlayerEvents {
  onJump?(): void;
  onWallJump?(): void;
  onDash?(): void;
  onLand?(): void;
  onDeath?(): void;
  onDreamEnter?(): void;
  onDreamExit?(): void;
}

function approach(val: number, target: number, amount: number): number {
  return val < target ? Math.min(val + amount, target) : Math.max(val - amount, target);
}

export class Player extends Actor {
  vx = 0;
  vy = 0;
  facing: -1 | 1 = 1;
  state: PlayerState = 'normal';

  dashes = 1;
  maxDashes = 1;
  stamina = C.MAX_STAMINA;

  // Wind applied by the scene (px/frame positional push)
  windX = 0;
  windY = 0;

  private jumpGraceTimer = 0;
  private jumpBufferTimer = 0;
  private varJumpTimer = 0;
  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private forceMoveXTimer = 0;
  private forceMoveXDir: -1 | 0 | 1 = 0;
  private dreamTimer = 0;
  dashDirX = 0;
  dashDirY = 0;

  /** Frames the whole game should freeze (consumed by the scene). */
  freezeRequest = 0;
  /** Whether the player was on the ground last frame (for landing events). */
  private wasOnGround = false;

  events: PlayerEvents = {};

  constructor(world: World) {
    super(world);
    this.w = C.PLAYER_W;
    this.h = C.PLAYER_H;
  }

  get dead(): boolean {
    return this.state === 'dead';
  }

  spawnAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.remX = 0;
    this.remY = 0;
    this.vx = 0;
    this.vy = 0;
    this.state = 'normal';
    this.dashes = this.maxDashes;
    this.stamina = C.MAX_STAMINA;
    this.jumpGraceTimer = 0;
    this.jumpBufferTimer = 0;
    this.varJumpTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.forceMoveXTimer = 0;
    this.dreamTimer = 0;
    this.windX = 0;
    this.windY = 0;
  }

  die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.vx = 0;
    this.vy = 0;
    this.events.onDeath?.();
  }

  override squish(): void {
    this.die();
  }

  refillDash(): boolean {
    if (this.dashes < this.maxDashes) {
      this.dashes = this.maxDashes;
      return true;
    }
    return false;
  }

  refillStamina(): void {
    this.stamina = C.MAX_STAMINA;
  }

  /** Launch from a spring: full vertical boost, refills dash + stamina. */
  bounce(vy: number): void {
    if (this.state === 'dead') return;
    this.state = 'normal';
    this.vy = vy;
    this.vx *= 0.4;
    this.varJumpTimer = 0;
    this.dashTimer = 0;
    this.refillDash();
    this.refillStamina();
  }

  update(input: PlayerInput): void {
    if (this.state === 'dead') return;

    // --- timers ---
    if (this.jumpGraceTimer > 0) this.jumpGraceTimer--;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer--;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer--;
    if (this.forceMoveXTimer > 0) this.forceMoveXTimer--;

    if (input.jumpPressed) this.jumpBufferTimer = C.JUMP_BUFFER;

    const onGround = this.isOnGround();
    if (onGround) {
      this.jumpGraceTimer = C.JUMP_GRACE;
      if (this.state !== 'dream') {
        this.refillDash();
        this.refillStamina();
      }
      if (!this.wasOnGround && this.vy >= 0) this.events.onLand?.();
    }
    this.wasOnGround = onGround;

    let moveX = input.moveX;
    if (this.forceMoveXTimer > 0) moveX = this.forceMoveXDir;
    if (moveX !== 0 && this.state !== 'climb') this.facing = moveX;

    switch (this.state) {
      case 'normal':
        this.updateNormal(input, moveX, onGround);
        break;
      case 'dash':
        this.updateDash(input, onGround);
        break;
      case 'dream':
        this.updateDream();
        return; // dream handles its own movement
      case 'climb':
        this.updateClimb(input);
        break;
    }

    // --- dash start (any non-dead, non-dream state) ---
    if (
      input.dashPressed &&
      this.dashes > 0 &&
      this.dashCooldownTimer <= 0 &&
      this.state !== 'dash' &&
      (this.state as PlayerState) !== 'dream'
    ) {
      this.startDash(input);
    }

    // --- integrate ---
    const wasCollideX = this.moveX(this.vx + this.windX, () => {
      if (this.state !== 'dash') this.vx = 0;
    });
    if (wasCollideX && this.state === 'dash' && !this.tryDreamEnter()) {
      this.vx = 0;
    }
    const wasCollideY = this.moveY(this.vy + this.windY, () => {
      if (this.state !== 'dash') {
        if (this.vy < 0) this.varJumpTimer = 0;
        this.vy = 0;
      }
    });
    if (wasCollideY && this.state === 'dash' && !this.tryDreamEnter()) {
      if (this.vy < 0) this.varJumpTimer = 0;
      this.vy = 0;
    }
  }

  // ---------------------------------------------------------------- normal
  private updateNormal(input: PlayerInput, moveX: -1 | 0 | 1, onGround: boolean): void {
    // Horizontal accel
    const mult = onGround ? 1 : C.AIR_MULT;
    if (Math.abs(this.vx) > C.MAX_RUN && Math.sign(this.vx) === moveX && moveX !== 0) {
      // Over max speed in the same direction (post-dash): bleed off slowly
      this.vx = approach(this.vx, C.MAX_RUN * moveX, C.RUN_DECEL * 0.4 * mult);
    } else if (moveX !== 0) {
      this.vx = approach(this.vx, C.MAX_RUN * moveX, C.RUN_ACCEL * mult);
    } else {
      this.vx = approach(this.vx, 0, (onGround ? C.RUN_DECEL : C.RUN_ACCEL * mult));
    }

    // Try to grab
    if (
      input.grabHeld &&
      !onGround &&
      this.stamina > 0 &&
      this.vy >= -1 &&
      this.wallAt(this.facing)
    ) {
      this.state = 'climb';
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Gravity (half near apex while jump held)
    if (!onGround) {
      const maxFall = input.moveY > 0 ? C.FAST_FALL : C.MAX_FALL;
      let grav = C.GRAVITY;
      if (Math.abs(this.vy) < C.HALF_GRAV_THRESHOLD && input.jumpHeld) grav *= 0.5;
      // Wall slide: pressing into a wall while falling
      const slidingDir = moveX !== 0 && this.vy > 0 && this.wallAt(moveX) ? moveX : 0;
      this.vy = approach(this.vy, maxFall, input.moveY > 0 ? C.FAST_FALL_ACCEL : grav);
      if (slidingDir !== 0 && this.vy > C.WALL_SLIDE_MAX) this.vy = C.WALL_SLIDE_MAX;
    }

    // Variable jump sustain
    if (this.varJumpTimer > 0) {
      this.varJumpTimer--;
      if (input.jumpHeld) this.vy = Math.min(this.vy, C.JUMP_SPEED);
      else this.varJumpTimer = 0;
    }

    // Jumping
    if (this.jumpBufferTimer > 0) {
      if (onGround || this.jumpGraceTimer > 0) {
        this.jump(moveX);
      } else if (this.wallAt(-1, C.WALL_JUMP_CHECK)) {
        this.wallJump(1);
      } else if (this.wallAt(1, C.WALL_JUMP_CHECK)) {
        this.wallJump(-1);
      }
    }
  }

  private jump(moveX: -1 | 0 | 1): void {
    this.jumpBufferTimer = 0;
    this.jumpGraceTimer = 0;
    this.varJumpTimer = C.VAR_JUMP_TIME;
    this.vy = C.JUMP_SPEED;
    this.vx += C.JUMP_HBOOST * moveX;
    this.events.onJump?.();
  }

  private wallJump(dir: -1 | 1): void {
    this.jumpBufferTimer = 0;
    this.varJumpTimer = C.VAR_JUMP_TIME;
    this.vy = C.JUMP_SPEED;
    this.vx = C.WALL_JUMP_HX * dir;
    this.facing = dir;
    this.forceMoveXTimer = C.WALL_JUMP_FORCE_TIME;
    this.forceMoveXDir = dir;
    this.state = 'normal';
    this.events.onWallJump?.();
  }

  // ---------------------------------------------------------------- dash
  private startDash(input: PlayerInput): void {
    this.dashes--;
    this.dashCooldownTimer = C.DASH_COOLDOWN;
    this.dashTimer = C.DASH_TIME;
    this.state = 'dash';
    this.freezeRequest = C.DASH_FREEZE;

    let dx = input.moveX;
    let dy = input.moveY;
    if (dx === 0 && dy === 0) dx = this.facing;
    const len = Math.hypot(dx, dy);
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.vx = this.dashDirX * C.DASH_SPEED;
    this.vy = this.dashDirY * C.DASH_SPEED;
    this.varJumpTimer = 0;
    this.events.onDash?.();
  }

  private updateDash(input: PlayerInput, onGround: boolean): void {
    this.vx = this.dashDirX * C.DASH_SPEED;
    this.vy = this.dashDirY * C.DASH_SPEED;

    // Jump out of a grounded dash (supers/hypers emerge from keeping vx)
    if (this.jumpBufferTimer > 0 && (onGround || this.jumpGraceTimer > 0)) {
      this.state = 'normal';
      this.dashTimer = 0;
      this.jump(input.moveX);
      return;
    }

    this.dashTimer--;
    if (this.dashTimer <= 0) {
      this.state = 'normal';
      this.vx = this.dashDirX * C.END_DASH_SPEED;
      this.vy = this.dashDirY * C.END_DASH_SPEED;
      if (this.dashDirY < 0) this.vy *= C.DASH_UP_MULT;
    }
  }

  // ---------------------------------------------------------------- dream
  /** If a dash collides with a dream block, tunnel through it instead of stopping. */
  private tryDreamEnter(): boolean {
    const probe: Rect = {
      x: this.x + Math.sign(this.dashDirX),
      y: this.y + Math.sign(this.dashDirY),
      w: this.w,
      h: this.h,
    };
    for (const s of this.world.solids) {
      if (s.dream && s.collidable && rectsOverlap(probe, s)) {
        this.enterDream();
        return true;
      }
    }
    return false;
  }

  private enterDream(): void {
    this.state = 'dream';
    this.dreamTimer = C.DREAM_MAX_TIME;
    for (const s of this.world.solids) if (s.dream) s.collidable = false;
    this.events.onDreamEnter?.();
  }

  private updateDream(): void {
    this.dreamTimer--;
    const killed = { hit: false };
    this.moveX(this.dashDirX * C.DREAM_SPEED, () => (killed.hit = true));
    this.moveY(this.dashDirY * C.DREAM_SPEED, () => (killed.hit = true), true);
    const inside = this.world.solids.some((s) => s.dream && rectsOverlap(this, s));
    if (killed.hit || (this.dreamTimer <= 0 && inside)) {
      this.exitDreamBlocks();
      this.die();
      return;
    }
    if (!inside) {
      this.exitDreamBlocks();
      this.state = 'normal';
      this.dashTimer = 0;
      this.refillDash();
      this.refillStamina();
      this.vx = this.dashDirX * C.DASH_SPEED;
      this.vy = this.dashDirY * C.DASH_SPEED;
      this.events.onDreamExit?.();
    }
  }

  private exitDreamBlocks(): void {
    for (const s of this.world.solids) if (s.dream) s.collidable = true;
  }

  // ---------------------------------------------------------------- climb
  private updateClimb(input: PlayerInput): void {
    const wallDir = this.facing;

    if (!input.grabHeld || this.stamina <= 0) {
      this.state = 'normal';
      return;
    }
    if (!this.wallAt(wallDir, 2)) {
      // Climbed past the top of the wall: pop up over the ledge
      if (input.moveY < 0) {
        this.vy = C.LEDGE_POP_SPEED;
        this.varJumpTimer = 0;
      }
      this.state = 'normal';
      return;
    }

    this.vx = 0;
    if (input.moveY < 0) {
      this.vy = C.CLIMB_UP_SPEED;
      this.stamina -= C.CLIMB_UP_COST;
    } else if (input.moveY > 0) {
      this.vy = C.CLIMB_DOWN_SPEED;
    } else {
      this.vy = 0;
      this.stamina -= C.STAMINA_HOLD_COST;
    }

    if (this.isOnGround() && input.moveY > 0) {
      this.state = 'normal';
      return;
    }

    // Jumps from a wall
    if (this.jumpBufferTimer > 0) {
      if (input.moveX === -wallDir) {
        this.wallJump(-wallDir as -1 | 1);
      } else if (this.stamina >= C.CLIMB_JUMP_COST || this.isOnGround()) {
        // Climb-jump: hop up the same wall
        if (!this.isOnGround()) this.stamina -= C.CLIMB_JUMP_COST;
        this.jumpBufferTimer = 0;
        this.varJumpTimer = C.VAR_JUMP_TIME;
        this.vy = C.JUMP_SPEED;
        this.state = 'normal';
        this.events.onJump?.();
      } else {
        this.wallJump(-wallDir as -1 | 1);
      }
    }
  }

  /** Current animation key for the sprite system. */
  get animState(): string {
    if (this.state === 'dead') return 'dead';
    if (this.state === 'dash' || this.state === 'dream') return 'dash';
    if (this.state === 'climb') return 'climb';
    if (!this.isOnGround()) return this.vy < 0 ? 'jump' : 'fall';
    if (Math.abs(this.vx) > 0.2) return 'run';
    return 'idle';
  }

  get lowStamina(): boolean {
    return this.state === 'climb' && this.stamina < C.LOW_STAMINA;
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
