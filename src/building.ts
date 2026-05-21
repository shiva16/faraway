import type { BuildingKind, ResourceKind, ResourceNode, Resources, TechDef, TechId } from './types';

// ── Building definitions ──────────────────────────────────────────────────────

export interface BuildingDef {
  kind: BuildingKind;
  label: string;
  desc: string;
  cost: Resources;
  unique: boolean;
  size: 1 | 2;
  maxHp: number;
}

export const BUILDING_DEFS: BuildingDef[] = [
  {
    kind: 'shelter',
    label: 'Shelter',
    desc: 'Rest to restore HP/Hunger/Essence. Sets your respawn point. Train villagers here.',
    cost: { wood: 20, stone: 0, food: 0, coin: 0 },
    unique: true, size: 1, maxHp: 200,
  },
  {
    kind: 'workshop',
    label: 'Workshop',
    desc: 'Unlocks tech research. Train soldiers. Craft axes and pickaxes.',
    cost: { wood: 30, stone: 10, food: 0, coin: 0 },
    unique: true, size: 1, maxHp: 200,
  },
  {
    kind: 'forge',
    label: 'Forge',
    desc: 'Gathering yields +50%. Craft swords and medicine.',
    cost: { wood: 0, stone: 20, food: 0, coin: 10 },
    unique: true, size: 1, maxHp: 300,
  },
  {
    kind: 'signal_fire',
    label: 'Signal Fire',
    desc: 'Visible for miles. Activates ghost ship interaction. Boosts sanity at night.',
    cost: { wood: 15, stone: 0, food: 0, coin: 0 },
    unique: true, size: 1, maxHp: 100,
  },
  {
    kind: 'dock',
    label: 'Dock',
    desc: 'Build and launch your ship. The way off the island.',
    cost: { wood: 40, stone: 20, food: 0, coin: 0 },
    unique: true, size: 2, maxHp: 250,
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
    flavorText: 'Kelp woven into canvas. Coarser than you\'d like. It will work.',
  },
  {
    id: 'compass',
    label: 'Compass',
    desc: '5 Stone · 15 Coin',
    cost: { wood: 0, stone: 5, food: 0, coin: 15 },
    flavorText: 'Salvaged from the ruins. The needle still finds north.',
  },
];

// ── Tech tree ─────────────────────────────────────────────────────────────────

export const TECH_DEFS: TechDef[] = [
  {
    id: 'better_tools',
    label: 'Better Tools',
    desc: 'All resource gathering yields +50% more.',
    cost: { wood: 20, stone: 10, food: 0, coin: 0 },
    requires: null,
  },
  {
    id: 'archery',
    label: 'Archery',
    desc: 'Soldiers gain ranged attack (4 tile range).',
    cost: { wood: 15, stone: 0, food: 0, coin: 10 },
    requires: null,
  },
  {
    id: 'masonry',
    label: 'Masonry',
    desc: 'All buildings cost 25% less stone.',
    cost: { wood: 0, stone: 20, food: 10, coin: 0 },
    requires: null,
  },
];

// ── Items (craftable) ─────────────────────────────────────────────────────────

export interface ItemDef {
  kind: string;
  label: string;
  desc: string;
  cost: Resources;
  craftAt: BuildingKind;
  effect: string;
}

export const ITEM_DEFS: ItemDef[] = [
  {
    kind: 'axe',
    label: 'Iron Axe',
    desc: 'Wood gathering × 2.',
    cost: { wood: 5, stone: 8, food: 0, coin: 0 },
    craftAt: 'workshop',
    effect: 'wood_x2',
  },
  {
    kind: 'pickaxe',
    label: 'Stone Pickaxe',
    desc: 'Stone + coin gathering × 2.',
    cost: { wood: 8, stone: 5, food: 0, coin: 0 },
    craftAt: 'workshop',
    effect: 'stone_x2',
  },
  {
    kind: 'sword',
    label: 'Iron Sword',
    desc: 'Attack damage +25 (total 50).',
    cost: { wood: 0, stone: 5, food: 0, coin: 10 },
    craftAt: 'forge',
    effect: 'attack_+25',
  },
  {
    kind: 'medicine',
    label: 'Medicine',
    desc: 'Restores 50 HP instantly.',
    cost: { wood: 5, stone: 0, food: 10, coin: 5 },
    craftAt: 'forge',
    effect: 'heal_50',
  },
  {
    kind: 'ration',
    label: 'Ration Pack',
    desc: 'Restores 40 Hunger. Useful for long expeditions.',
    cost: { wood: 0, stone: 0, food: 15, coin: 0 },
    craftAt: 'shelter',
    effect: 'hunger_40',
  },
];

// ── NPC survivors ─────────────────────────────────────────────────────────────

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  spawnEra: 2 | 3;
  tx: number;
  ty: number;
  questItem: ResourceKind;
  questAmount: number;
  rewardLabel: string;
  questLines: string[];
  rewardLines: string[];
  skillEffect: string;
}

export const NPC_DEFS: NpcDef[] = [
  {
    id: 'maya',
    name: 'Maya',
    title: 'the Fisher',
    spawnEra: 2,
    tx: 20, ty: 33,
    questItem: 'food', questAmount: 20,
    rewardLabel: 'Fishing Mastery (+50% food)',
    questLines: [
      '"Oh — you built something. I thought I was alone here."',
      '"I\'ve been fishing these shores for weeks. Bring me 20 food",',
      '"and I\'ll teach you where the real shoals are."',
    ],
    rewardLines: [
      '"You found them all. The deep spots, the cold channels."',
      '"I\'ve shown you what I know. Fishing Mastery is yours."',
      '"Don\'t waste it. And — thank you. For building something here."',
    ],
    skillEffect: 'food_x1.5',
  },
  {
    id: 'ren',
    name: 'Ren',
    title: 'the Smith',
    spawnEra: 2,
    tx: 8, ty: 20,
    questItem: 'stone', questAmount: 15,
    rewardLabel: 'Forging Mastery (+25 attack base)',
    questLines: [
      '"A forge. You actually built one."',
      '"I haven\'t seen proper ironwork since — well."',
      '"Bring me 15 stone. I\'ll show you what forging really means."',
    ],
    rewardLines: [
      '"Good weight. Clean grain. This will hold."',
      '"Forging Mastery. Your attack base is now +25."',
      '"Build well. That\'s all any of us can do."',
    ],
    skillEffect: 'attack_base+25',
  },
  {
    id: 'lena',
    name: 'Lena',
    title: 'the Healer',
    spawnEra: 3,
    tx: 28, ty: 20,
    questItem: 'coin', questAmount: 10,
    rewardLabel: 'Medicine recipe unlocked',
    questLines: [
      '"You\'re alive. That\'s already more than I expected."',
      '"Ten coin — for the reagents I can\'t gather myself."',
      '"I\'ll teach you to make medicine. Proper medicine."',
    ],
    rewardLines: [
      '"That\'s enough. Medicine recipe: yours."',
      '"Five food, five coin, a bit of wood. Craft it at the forge."',
      '"There will be nights you\'re glad you know this."',
    ],
    skillEffect: 'medicine_unlocked',
  },
];

// ── Random events (FTL feel) ───────────────────────────────────────────────────

export interface GameEvent {
  id: string;
  title: string;
  desc: string;
  effect: string;   // 'dmg_workshop' | 'steal_wood_10' | 'bonus_food_15' | 'wolf_pack' etc.
  tone: 'bad' | 'good' | 'neutral';
  minDay: number;   // earliest day this can trigger
}

export const RANDOM_EVENTS: GameEvent[] = [
  {
    id: 'storm_workshop',
    title: 'Sudden Storm',
    desc: 'A squall came through the night. Your Workshop took damage.',
    effect: 'dmg_workshop_30',
    tone: 'bad',
    minDay: 2,
  },
  {
    id: 'wolves_food',
    title: 'Wolves in the Night',
    desc: 'You woke to overturned stores. Lost 10 food.',
    effect: 'steal_food_10',
    tone: 'bad',
    minDay: 1,
  },
  {
    id: 'driftwood',
    title: 'Driftwood Cache',
    desc: 'A tide-washed pile of timber arrived overnight. +15 wood.',
    effect: 'bonus_wood_15',
    tone: 'good',
    minDay: 2,
  },
  {
    id: 'rich_vein',
    title: 'Rich Vein Exposed',
    desc: 'A rockslide exposed new stone near the cave. +12 stone.',
    effect: 'bonus_stone_12',
    tone: 'good',
    minDay: 3,
  },
  {
    id: 'fog_rot',
    title: 'Fog Rot',
    desc: 'Three days of fog. Your food stores spoiled slightly. -8 food.',
    effect: 'steal_food_8',
    tone: 'bad',
    minDay: 2,
  },
  {
    id: 'strange_coins',
    title: 'Strange Coins',
    desc: 'You found a pouch buried near the ruins. +10 coin.',
    effect: 'bonus_coin_10',
    tone: 'good',
    minDay: 3,
  },
  {
    id: 'wolf_pack',
    title: 'Wolf Pack',
    desc: 'A large pack emerged from the forest. Raid level increased.',
    effect: 'raid_level+1',
    tone: 'bad',
    minDay: 4,
  },
  {
    id: 'calm_seas',
    title: 'Calm Seas',
    desc: 'An unusually calm night. Everyone slept well. Full sanity restored.',
    effect: 'sanity_full',
    tone: 'good',
    minDay: 1,
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

export function techApplied(id: TechId, researched: TechId[]): boolean {
  return researched.includes(id);
}
