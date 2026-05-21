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

// ── Entities (wildlife) ───────────────────────────────────────────────────────

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
  hp?: number;
  maxHp?: number;
}

// ── Units (player's people) ───────────────────────────────────────────────────

export type UnitKind = 'villager' | 'soldier';

export type UnitTask =
  | 'idle'
  | 'gathering'  // walking to / working at a resource node
  | 'returning'  // carrying resources back to nearest building
  | 'moving'     // following a move command
  | 'attacking'  // fighting an enemy
  | 'patrolling';

export interface Unit {
  id: string;
  kind: UnitKind;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  maxHp: number;
  task: UnitTask;
  taskTarget: string | null;   // resource node id / entity id / null
  selected: boolean;
  frame: number;
  frameTimer: number;
  attackCooldown: number;
  carryKind: 'wood' | 'stone' | 'food' | 'coin' | null;
  carryAmount: number;
  alive: boolean;
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
  yield: number;
  respawnSecs: number;
  label: string;
}

// ── Buildings ─────────────────────────────────────────────────────────────────

export type BuildingKind =
  | 'shelter'
  | 'workshop'
  | 'forge'
  | 'signal_fire'
  | 'dock'
  | 'tree_nursery'      // grows seedlings; unlocks rare planting
  | 'seed_bank'         // protects species from extinction events
  | 'ranger_station'    // trains forest rangers; threat combat bonus
  | 'water_catchment'   // unlocks wetland/aquatic species; food bonus
  | 'myco_lab';         // extends mycorrhizal network; forest spread ×2

export interface PlacedBuilding {
  id: string;
  kind: BuildingKind;
  tx: number;
  ty: number;
  hp: number;
  maxHp: number;
}

// ── Items & Inventory ─────────────────────────────────────────────────────────

export type ItemKind = 'axe' | 'pickaxe' | 'sword' | 'medicine' | 'ration';

export interface Item {
  kind: ItemKind;
  qty: number;
}

// ── Era + Season ──────────────────────────────────────────────────────────────

export type Era    = 1 | 2 | 3;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// ── Tech ─────────────────────────────────────────────────────────────────────

export type TechId =
  | 'better_tools'      // +50% gather yield
  | 'archery'           // unlocks soldiers with ranged attack
  | 'masonry';          // buildings cost -25% stone

export interface TechDef {
  id: TechId;
  label: string;
  desc: string;
  cost: Resources;
  requires: TechId | null;
}

// ── Forest / Botany ───────────────────────────────────────────────────────────

/** A tile that has been planted with a species */
export interface PlantedTile {
  speciesId: string;
  plantedDay: number;   // in-game day when planted
  maturity: number;     // 0–1; reaches 1 after growthSeasons complete
  health: number;       // 0–1; affected by neighbours, season, threats
}

/** An active threat camp on the map */
export interface ThreatCamp {
  id: string;            // unique instance id
  threatId: string;      // references ThreatDef.id
  tx: number;
  ty: number;
  hp: number;
  maxHp: number;
  educationShown: boolean;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface SaveState {
  version: number;
  px: number;
  py: number;
  dir: Dir;
  discoveries: string[];
  flags: Record<string, boolean | number>;
  playTime: number;
  lastSaved: string;
  collectedRunes: RuneKind[];
  essence: number;
  // v3
  resources: Resources;
  buildings: PlacedBuilding[];
  era: Era;
  shipParts: string[];
  // v4
  hp: number;
  hunger: number;
  sanity: number;
  researched: TechId[];
  inventory: Item[];
  equippedItem: ItemKind | null;
  season: Season;
  seasonTimer: number;   // real seconds remaining in current season
  respawnX: number;
  respawnY: number;
  enemyCampHp: number;
  raidLevel: number;     // current raiders-per-night count
  dayCount: number;      // in-game days elapsed
  // v5 — Forest Restoration
  plantedTiles: Record<string, PlantedTile>;  // key = `${tx},${ty}`
  threatCamps: ThreatCamp[];
  biodiversityLog: number[];   // index reading per in-game day (for chart)
  carbonCredits: number;       // earned by restoring ecosystems
}

export function defaultSave(): SaveState {
  return {
    version: 4,
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
    hp: 100,
    hunger: 100,
    sanity: 100,
    researched: [],
    inventory: [],
    equippedItem: null,
    season: 'summer',
    seasonTimer: 120,
    respawnX: 24,
    respawnY: 30,
    enemyCampHp: 400,
    raidLevel: 1,
    dayCount: 0,
    plantedTiles: {},
    threatCamps: [],
    biodiversityLog: [],
    carbonCredits: 0,
  };
}
