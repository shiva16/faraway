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
  base: string;   // base fill color
  alt?: string;   // alternate color for checker variation
  passable: boolean;
  dark?: boolean; // draw with dim overlay (cave/deep forest)
  wet?: boolean;  // animate
  zone?: string;  // zone name shown when entering
}

// ── World ─────────────────────────────────────────────────────────────────────

export const WORLD_W = 48;
export const WORLD_H = 36;

// ── Player ───────────────────────────────────────────────────────────────────

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Player {
  x: number;   // fractional tile position (center)
  y: number;
  dir: Dir;
  moving: boolean;
  frame: number;   // walk frame 0-3
  frameTimer: number;
}

// ── Interactables ─────────────────────────────────────────────────────────────

export interface Interactable {
  id: string;
  tx: number;     // tile X (center)
  ty: number;     // tile Y
  range: number;  // interaction range in tiles
  prompt: string; // "Press E to ..."
  lines: string[]; // dialog lines (paginated)
  discoveryId?: string;
  sprite?: string; // visual marker ('bottle', 'chest', 'note', 'stone', 'fire', 'shrine')
}

// ── Discoveries ───────────────────────────────────────────────────────────────

export interface Discovery {
  id: string;
  title: string;
  desc: string;
  symbol: string; // 1-2 char icon for pixel art display
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface SaveState {
  version: number;
  px: number;
  py: number;
  dir: Dir;
  discoveries: string[];
  flags: Record<string, boolean>;
  playTime: number;   // seconds
  lastSaved: string;
}

export function defaultSave(): SaveState {
  return {
    version: 1,
    px: 24,
    py: 30,
    dir: 'up',
    discoveries: [],
    flags: {},
    playTime: 0,
    lastSaved: new Date().toISOString(),
  };
}
