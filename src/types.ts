// ── Tile IDs ─────────────────────────────────────────────────────────────────

export const enum T {
  DEEP_WATER   = 0,
  WATER        = 1,
  SHALLOW      = 2,
  SAND         = 3,
  GRASS_LIGHT  = 4,
  GRASS        = 5,
  FOREST_EDGE  = 6,  // passable, dim
  FOREST       = 7,  // impassable
  PATH         = 8,
  RUIN_WALL    = 9,  // impassable
  RUIN_FLOOR   = 10,
  CAVE_WALL    = 11, // impassable
  CAVE_FLOOR   = 12,
  SHALLOW_DARK = 13, // cave water
}

export interface TileDef {
  base: string;
  alt?: string;
  passable: boolean;
  dark?: boolean;
  wet?: boolean;
  zone?: string;
}

// ── World ─────────────────────────────────────────────────────────────────────

export const WORLD_W = 48;
export const WORLD_H = 36;

// ── Player ───────────────────────────────────────────────────────────────────

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Player {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  frame: number;
  frameTimer: number;
}

// ── Interactables ─────────────────────────────────────────────────────────────

export interface Interactable {
  id: string;
  tx: number;
  ty: number;
  range: number;
  prompt: string;
  lines: string[];
  discoveryId?: string;
  sprite?: string;
}

// ── Discoveries ───────────────────────────────────────────────────────────────

export interface Discovery {
  id: string;
  title: string;
  desc: string;
  symbol: string;
}

// ── Entities ──────────────────────────────────────────────────────────────────

export type EntityKind = 'deer' | 'bird' | 'wolf' | 'fox';

export interface Entity {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;     // wander/animation offset
  state: 'idle' | 'wander' | 'flee' | 'hunt' | 'lead';
  stateTimer: number;
  alive: boolean;
  // bird flock index
  flock?: number;
}

// ── Spells ────────────────────────────────────────────────────────────────────

export type RuneKind = 'fire' | 'water' | 'earth' | 'wind';

export interface ActiveSpell {
  kind: RuneKind;
  timer: number;     // frames remaining
  // fire orb position
  ox?: number;
  oy?: number;
  ovx?: number;
  ovy?: number;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface SaveState {
  version: number;
  px: number;
  py: number;
  dir: Dir;
  discoveries: string[];
  flags: Record<string, boolean>;
  playTime: number;
  lastSaved: string;
  collectedRunes: RuneKind[];
  essence: number;
}

export function defaultSave(): SaveState {
  return {
    version: 2,
    px: 24,
    py: 30,
    dir: 'up',
    discoveries: [],
    flags: {},
    playTime: 0,
    lastSaved: new Date().toISOString(),
    collectedRunes: [],
    essence: 100,
  };
}
