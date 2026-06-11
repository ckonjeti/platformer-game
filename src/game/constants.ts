/**
 * All tuned gameplay numbers, in pixels-per-frame at 60 fps.
 * Derived from Celeste's decompiled values (px/sec ÷ 60).
 */

// --- Running / gravity ---
export const GRAVITY = 0.25; // ~900 px/s²
export const MAX_FALL = 2.67; // 160 px/s
export const FAST_FALL = 4.0; // 240 px/s holding down
export const FAST_FALL_ACCEL = 0.5;
export const MAX_RUN = 1.5; // 90 px/s
export const RUN_ACCEL = 0.27; // ~6 frames to max speed
export const RUN_DECEL = 0.4; // ~4 frames to stop
export const AIR_MULT = 0.65;

// --- Jumping ---
export const JUMP_SPEED = -1.75; // -105 px/s (Celeste's JumpSpeed); ~3.5-tile max jump
export const JUMP_HBOOST = 0.67; // 40 px/s horizontal boost when moving
export const VAR_JUMP_TIME = 12; // frames jump can be sustained
export const JUMP_GRACE = 6; // coyote time, frames
export const JUMP_BUFFER = 6; // input buffer, frames
export const HALF_GRAV_THRESHOLD = 0.67; // |vy| below this + jump held → half gravity

// --- Dashing ---
export const DASH_SPEED = 4.0; // 240 px/s
export const DASH_TIME = 9; // frames at fixed velocity
export const DASH_COOLDOWN = 12; // frames before another dash may start
export const DASH_FREEZE = 3; // freeze-frames on dash start
export const END_DASH_SPEED = 2.67; // 160 px/s retained
export const DASH_UP_MULT = 0.75; // upward retain multiplier

// --- Walls / climbing ---
export const WALL_SLIDE_MAX = 1.0; // 60 px/s
export const WALL_JUMP_HX = 2.17; // 130 px/s away from wall
export const WALL_JUMP_FORCE_TIME = 10; // frames of forced horizontal input
export const WALL_JUMP_CHECK = 3; // px tolerance for walljump
export const CLIMB_UP_SPEED = -0.75; // 45 px/s
export const CLIMB_DOWN_SPEED = 1.33; // 80 px/s
export const LEDGE_POP_SPEED = -2.0; // hop when climbing past a ledge

// --- Stamina ---
export const MAX_STAMINA = 110;
export const CLIMB_UP_COST = 45.45 / 60; // per frame while climbing up (~14 tiles on full stamina)
export const STAMINA_HOLD_COST = 10 / 60; // per frame while hanging
export const CLIMB_JUMP_COST = 27.5;
export const LOW_STAMINA = 20; // flash warning threshold

// --- Entities ---
export const SPRING_SPEED = -4.6; // 275 px/s
export const DREAM_SPEED = 4.0; // dream-block travel speed
export const DREAM_MAX_TIME = 90; // safety: frames inside before death
export const CRUMBLE_SHAKE_TIME = 30;
export const CRUMBLE_GONE_TIME = 90;
export const CRYSTAL_RESPAWN_TIME = 150;
export const PLATFORM_SPEED = 1.0;

// --- Player shape ---
export const PLAYER_W = 8;
export const PLAYER_H = 11;

// --- Flow ---
export const DEATH_TIME = 30; // frames of death pause before respawn
export const RESPAWN_TIME = 16; // frames of respawn wipe
export const TRANSITION_TIME = 18; // frames of room slide
