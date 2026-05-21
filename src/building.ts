import type { BuildingKind, ResourceKind, ResourceNode, Resources } from './types';

// ── Building definitions ──────────────────────────────────────────────────────

export interface BuildingDef {
  kind: BuildingKind;
  label: string;
  desc: string;
  cost: Resources;
  unique: boolean;   // only one allowed
  size: 1 | 2;      // tile footprint (1×1 or 2×2)
}

export const BUILDING_DEFS: BuildingDef[] = [
  {
    kind: 'shelter',
    label: 'Shelter',
    desc: 'Rest here to restore essence. Marks a safe spot.',
    cost: { wood: 20, stone: 0, food: 0, coin: 0 },
    unique: true,
    size: 1,
  },
  {
    kind: 'workshop',
    label: 'Workshop',
    desc: 'Unlocks crafting. Required for advanced builds.',
    cost: { wood: 30, stone: 10, food: 0, coin: 0 },
    unique: true,
    size: 1,
  },
  {
    kind: 'forge',
    label: 'Forge',
    desc: 'Upgrade your tools. Gathering yields 50% more.',
    cost: { wood: 0, stone: 20, food: 0, coin: 10 },
    unique: true,
    size: 1,
  },
  {
    kind: 'signal_fire',
    label: 'Signal Fire',
    desc: 'A beacon. Ships can see this island now.',
    cost: { wood: 15, stone: 0, food: 0, coin: 0 },
    unique: true,
    size: 1,
  },
  {
    kind: 'dock',
    label: 'Dock',
    desc: 'Build and launch a ship. Your way out.',
    cost: { wood: 40, stone: 20, food: 0, coin: 0 },
    unique: true,
    size: 2,
  },
];

// ── Ship recipe ───────────────────────────────────────────────────────────────

export interface ShipPartDef {
  id: string;
  label: string;
  desc: string;
  cost: Resources;
  flavorText: string;
}

export const SHIP_PARTS: ShipPartDef[] = [
  {
    id: 'hull',
    label: 'Ship Hull',
    desc: '30 Wood · 10 Stone',
    cost: { wood: 30, stone: 10, food: 0, coin: 0 },
    flavorText: 'Heavy planks fitted together with stone pegs. It will float.',
  },
  {
    id: 'sail',
    label: 'Sail',
    desc: '10 Wood · 20 Food',
    cost: { wood: 10, stone: 0, food: 20, coin: 0 },
    flavorText: 'Kelp woven into canvas, stretched on a wooden frame. Coarser than you\'d like. It will work.',
  },
  {
    id: 'compass',
    label: 'Compass',
    desc: '5 Stone · 15 Coin',
    cost: { wood: 0, stone: 5, food: 0, coin: 15 },
    flavorText: 'Salvaged from the ruins. The needle still finds north. That\'s enough.',
  },
];

// ── Resource nodes ────────────────────────────────────────────────────────────

export const RESOURCE_NODES: ResourceNode[] = [
  // Wood — forest edge ring
  { id: 'w0', kind: 'wood',  tx: 9,  ty: 8,  yield: 8, respawnSecs: 45, label: 'chop wood' },
  { id: 'w1', kind: 'wood',  tx: 12, ty: 7,  yield: 7, respawnSecs: 45, label: 'chop wood' },
  { id: 'w2', kind: 'wood',  tx: 17, ty: 8,  yield: 8, respawnSecs: 45, label: 'chop wood' },
  { id: 'w3', kind: 'wood',  tx: 19, ty: 11, yield: 6, respawnSecs: 40, label: 'chop wood' },
  { id: 'w4', kind: 'wood',  tx: 8,  ty: 15, yield: 7, respawnSecs: 45, label: 'chop wood' },
  { id: 'w5', kind: 'wood',  tx: 7,  ty: 11, yield: 8, respawnSecs: 45, label: 'chop wood' },
  { id: 'w6', kind: 'wood',  tx: 15, ty: 16, yield: 6, respawnSecs: 40, label: 'chop wood' },
  { id: 'w7', kind: 'wood',  tx: 10, ty: 17, yield: 7, respawnSecs: 40, label: 'chop wood' },

  // Stone — cave area
  { id: 's0', kind: 'stone', tx: 5,  ty: 15, yield: 6, respawnSecs: 60, label: 'mine stone' },
  { id: 's1', kind: 'stone', tx: 4,  ty: 17, yield: 5, respawnSecs: 60, label: 'mine stone' },
  { id: 's2', kind: 'stone', tx: 6,  ty: 20, yield: 6, respawnSecs: 60, label: 'mine stone' },
  { id: 's3', kind: 'stone', tx: 3,  ty: 19, yield: 5, respawnSecs: 55, label: 'mine stone' },
  { id: 's4', kind: 'stone', tx: 8,  ty: 21, yield: 7, respawnSecs: 65, label: 'mine stone' },

  // Food — shore fishing spots
  { id: 'f0', kind: 'food',  tx: 22, ty: 34, yield: 6, respawnSecs: 30, label: 'fish here' },
  { id: 'f1', kind: 'food',  tx: 26, ty: 34, yield: 5, respawnSecs: 30, label: 'fish here' },
  { id: 'f2', kind: 'food',  tx: 18, ty: 33, yield: 6, respawnSecs: 35, label: 'fish here' },
  { id: 'f3', kind: 'food',  tx: 30, ty: 33, yield: 5, respawnSecs: 30, label: 'fish here' },
  { id: 'f4', kind: 'food',  tx: 14, ty: 31, yield: 4, respawnSecs: 25, label: 'fish here' },
  { id: 'f5', kind: 'food',  tx: 34, ty: 31, yield: 4, respawnSecs: 25, label: 'fish here' },

  // Coin — ruins salvage
  { id: 'c0', kind: 'coin',  tx: 29, ty: 14, yield: 4, respawnSecs: 90, label: 'salvage coins' },
  { id: 'c1', kind: 'coin',  tx: 33, ty: 15, yield: 3, respawnSecs: 90, label: 'salvage coins' },
  { id: 'c2', kind: 'coin',  tx: 31, ty: 18, yield: 4, respawnSecs: 90, label: 'salvage coins' },
  { id: 'c3', kind: 'coin',  tx: 34, ty: 13, yield: 3, respawnSecs: 80, label: 'salvage coins' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function canAfford(resources: Resources, cost: Resources): boolean {
  return (
    resources.wood  >= cost.wood  &&
    resources.stone >= cost.stone &&
    resources.food  >= cost.food  &&
    resources.coin  >= cost.coin
  );
}

export function deductCost(resources: Resources, cost: Resources): void {
  resources.wood  -= cost.wood;
  resources.stone -= cost.stone;
  resources.food  -= cost.food;
  resources.coin  -= cost.coin;
}

export function resourceColor(kind: ResourceKind): string {
  return { wood: '#8b6030', stone: '#8a8888', food: '#40a8c0', coin: '#c8a020' }[kind];
}

export function resourceIcon(kind: ResourceKind): string {
  return { wood: '🪵', stone: '⛏', food: '🐟', coin: '🪙' }[kind];
}
