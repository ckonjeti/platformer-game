/**
 * Celeste-style Actor/Solid physics.
 * Positions are integers; sub-pixel speeds accumulate in remainders and
 * movement happens 1 pixel at a time so nothing ever tunnels.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export const TILE = 8;

export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_SEMI = 2;

/** Collision world: a tile grid plus dynamic solids (platforms, crumble blocks...). */
export class World {
  cols: number;
  rows: number;
  tiles: Uint8Array;
  solids: Solid[] = [];

  constructor(cols: number, rows: number, tiles?: Uint8Array) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = tiles ?? new Uint8Array(cols * rows);
  }

  tileAt(tx: number, ty: number): number {
    // All bounds are open: room exits live at the edges, and the gameplay
    // scene clamps the player at edges that have no exit.
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return T_EMPTY;
    return this.tiles[ty * this.cols + tx] ?? T_EMPTY;
  }

  setTile(tx: number, ty: number, t: number): void {
    if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
      this.tiles[ty * this.cols + tx] = t;
    }
  }

  /** Is the rect overlapping any solid tile or collidable solid entity? */
  solidAt(rect: Rect, ignore?: Solid): boolean {
    const x0 = Math.floor(rect.x / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const x1 = Math.floor((rect.x + rect.w - 1) / TILE);
    const y1 = Math.floor((rect.y + rect.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) === T_SOLID) return true;
      }
    }
    for (const s of this.solids) {
      if (s !== ignore && s.collidable && overlaps(rect, s)) return true;
    }
    return false;
  }

  /**
   * Semisolid check for downward movement: true if moving the actor's bottom
   * from prevBottom down into this rect would cross a semisolid top edge.
   */
  semisolidAt(rect: Rect, prevBottom: number): boolean {
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.x + rect.w - 1) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.y + rect.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) === T_SEMI && prevBottom <= ty * TILE) return true;
      }
    }
    return false;
  }
}

export type CollideCallback = () => void;

/** A movable game object that collides with the world (player, etc.). */
export class Actor implements Rect {
  x = 0;
  y = 0;
  w = 8;
  h = 8;
  remX = 0;
  remY = 0;

  constructor(public world: World) {}

  /** Move horizontally by a sub-pixel amount. Returns true if a collision stopped movement. */
  moveX(amount: number, onCollide?: CollideCallback): boolean {
    this.remX += amount;
    let move = Math.round(this.remX);
    this.remX -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
      const next: Rect = { x: this.x + sign, y: this.y, w: this.w, h: this.h };
      if (this.world.solidAt(next)) {
        this.remX = 0;
        onCollide?.();
        return true;
      }
      this.x += sign;
      move -= sign;
    }
    return false;
  }

  /** Move vertically. Semisolids only block downward movement from above. */
  moveY(amount: number, onCollide?: CollideCallback, dropThrough = false): boolean {
    this.remY += amount;
    let move = Math.round(this.remY);
    this.remY -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
      const next: Rect = { x: this.x, y: this.y + sign, w: this.w, h: this.h };
      if (this.world.solidAt(next)) {
        this.remY = 0;
        onCollide?.();
        return true;
      }
      if (sign > 0 && !dropThrough && this.world.semisolidAt(next, this.y + this.h)) {
        this.remY = 0;
        onCollide?.();
        return true;
      }
      this.y += sign;
      move -= sign;
    }
    return false;
  }

  /** Standing on a solid tile, semisolid top, or solid entity? */
  isOnGround(): boolean {
    const below: Rect = { x: this.x, y: this.y + 1, w: this.w, h: this.h };
    return this.world.solidAt(below) || this.world.semisolidAt(below, this.y + this.h);
  }

  /** Is there a solid within `dist` px in horizontal direction `dir`? */
  wallAt(dir: -1 | 1, dist = 1): boolean {
    const probe: Rect = {
      x: dir > 0 ? this.x + dir * dist : this.x + dir * dist,
      y: this.y,
      w: this.w,
      h: this.h,
    };
    return this.world.solidAt(probe);
  }

  /** Called when crushed between solids. Override. */
  squish(): void {}
}

/** A solid that can move, carrying or pushing actors (moving platforms). */
export class Solid implements Rect {
  remX = 0;
  remY = 0;
  collidable = true;
  /** Dream blocks can be dashed through. */
  dream = false;

  constructor(
    public world: World,
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  /** Actors that should be carried: standing on top of this solid. */
  private getRiders(actors: Actor[]): Actor[] {
    return actors.filter(
      (a) => a.y + a.h === this.y && a.x < this.x + this.w && a.x + a.w > this.x,
    );
  }

  move(dx: number, dy: number, actors: Actor[]): void {
    this.remX += dx;
    this.remY += dy;
    const mx = Math.round(this.remX);
    const my = Math.round(this.remY);
    if (mx === 0 && my === 0) return;
    this.remX -= mx;
    this.remY -= my;
    const riders = this.getRiders(actors);
    this.collidable = false;

    if (mx !== 0) {
      this.x += mx;
      for (const a of actors) {
        if (overlaps(this, a)) {
          // Push the actor out of the way
          const push = mx > 0 ? this.x + this.w - a.x : this.x - (a.x + a.w);
          if (a.moveX(push, () => a.squish())) {
            // squished
          }
        } else if (riders.includes(a)) {
          a.moveX(mx);
        }
      }
    }
    if (my !== 0) {
      this.y += my;
      for (const a of actors) {
        if (overlaps(this, a)) {
          const push = my > 0 ? this.y + this.h - a.y : this.y - (a.y + a.h);
          if (a.moveY(push, () => a.squish())) {
            // squished
          }
        } else if (riders.includes(a)) {
          a.moveY(my);
        }
      }
    }
    this.collidable = true;
  }
}
