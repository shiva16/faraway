// ── Tile IDs ─────────────────────────────────────────────────────────────────

export const enum T {
  DEEP_WATER   = 0,
  WATER        = 1,
  SHALLOW      = 2,
  SAND         = 3,
  GRASS_LIGHT  = 4,
  GRASS        = 5,
  FOREST_EDGE  = 6,
  FOREST       = 7,
  PATH         = 8,
  RUIN_WALL    = 9,
  RUIN_FLOOR   = 10,
  CAVE_WALL    = 11,
  CAVE_FLOOR   = 12,
  SHALLOW_DARK = 13,
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
  phase: number;
  state: 'idle' | 'wander' | 'flee' | 'hunt' | 'lead';
  stateTimer: number;
  alive: boolean;
  flock?: number;
}

// ── Spells ────────────────────────────────────────────────────────────────────

export type RuneKind = 'fire' | 'water' | 'earth' | 'wind';

export interface ActiveSpell {
  kind: RuneKind;
  timer: number;
  ox?: number;
  oy?: number;
  ovx?: number;
  ovy?: number;
}

// ── Resources ─────────────────────────────────────────────────────────────────

export type ResourceKind = 'wood' | 'stone' | 'food' | 'coin';

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  coin: number;
}

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  tx: number;
  ty: number;
  yield: number;        // amount per gather
  respawnSecs: number;  // real seconds until restock
  label: string;        // gather prompt verb
}

// ── Buildings ─────────────────────────────────────────────────────────────────

export type BuildingKind = 'shelter' | 'workshop' | 'forge' | 'signal_fire' | 'dock';

export interface PlacedBuilding {
  id: string;
  kind: BuildingKind;
  tx: number;
  ty: number;
}

// ── Era ───────────────────────────────────────────────────────────────────────

export type Era = 1 | 2 | 3;

// ── Save state ────────────────────────────────────────────────────────────────

export interface SaveState {
  version: number;
  px: number;
  py: number;
  dir: Dir;
  discoveries: string[];
  flags: Record<string, boolean | number>;   // supports timestamps too
  playTime: number;
  lastSaved: string;
  collectedRunes: RuneKind[];
  essence: number;
  // v3 additions
  resources: Resources;
  buildings: PlacedBuilding[];
  era: Era;
  shipParts: string[];   // 'hull' | 'sail' | 'compass'
}

export function defaultSave(): SaveState {
  return {
    version: 3,
    px: 24,
    py: 30,
    dir: 'up',
    discoveries: [],
    flags: {},
    playTime: 0,
    lastSaved: new Date().toISOString(),
    collectedRunes: [],
    essence: 100,
    resources: { wood: 0, stone: 0, food: 0, coin: 0 },
    buildings: [],
    era: 1,
    shipParts: [],
  };
}
