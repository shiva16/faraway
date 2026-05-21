import { T, WORLD_W, WORLD_H } from './types';
import type { TileDef, Interactable, Discovery, RuneKind, Entity } from './types';

// ── Tile definitions ─────────────────────────────────────────────────────────

export const TILE_DEFS: Record<number, TileDef> = {
  [T.DEEP_WATER]:   { base: '#0c1f38', alt: '#0e2340', passable: false, wet: true },
  [T.WATER]:        { base: '#1a3d6b', alt: '#1e4475', passable: false, wet: true },
  [T.SHALLOW]:      { base: '#2d6b8a', alt: '#337a9e', passable: true,  wet: true },
  [T.SAND]:         { base: '#c8975a', alt: '#b8874a', passable: true },
  [T.GRASS_LIGHT]:  { base: '#4a8535', alt: '#558a3a', passable: true },
  [T.GRASS]:        { base: '#2e6120', alt: '#356b24', passable: true },
  [T.FOREST_EDGE]:  { base: '#1f4a14', alt: '#234d17', passable: true,  dark: true },
  [T.FOREST]:       { base: '#122b0a', alt: '#152e0c', passable: false, dark: true },
  [T.PATH]:         { base: '#8b7355', alt: '#7d6649', passable: true },
  [T.RUIN_WALL]:    { base: '#3c3028', alt: '#332820', passable: false },
  [T.RUIN_FLOOR]:   { base: '#6b5a48', alt: '#5e4e3e', passable: true },
  [T.CAVE_WALL]:    { base: '#18181e', alt: '#141418', passable: false, dark: true },
  [T.CAVE_FLOOR]:   { base: '#2e2e38', alt: '#28283a', passable: true,  dark: true },
  [T.SHALLOW_DARK]: { base: '#1a2c3d', alt: '#1c3044', passable: true,  wet: true, dark: true },
};

// ── Deterministic noise (no rng — same map every run) ────────────────────────

function noise(x: number, y: number): number {
  return (
    Math.sin(x * 0.73 + 1.3) * Math.cos(y * 0.67 + 0.9) * 0.07 +
    Math.sin(x * 1.41 + y * 0.88) * 0.05 +
    Math.cos(x * 0.38 + y * 1.24) * 0.03
  );
}

// ── World generation ─────────────────────────────────────────────────────────

export function buildWorld(): T[][] {
  const W = WORLD_W, H = WORLD_H;
  const cx = W / 2, cy = H / 2;
  const map: T[][] = [];

  // Base terrain — elliptical island
  for (let y = 0; y < H; y++) {
    const row: T[] = [];
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W * 0.43);
      const dy = (y - cy) / (H * 0.40);
      const d  = Math.sqrt(dx * dx + dy * dy) + noise(x, y);

      let t: T;
      if      (d > 1.00) t = T.DEEP_WATER;
      else if (d > 0.86) t = T.WATER;
      else if (d > 0.74) t = T.SHALLOW;
      else if (d > 0.63) t = T.SAND;
      else if (d > 0.52) t = T.GRASS_LIGHT;
      else               t = T.GRASS;
      row.push(t);
    }
    map.push(row);
  }

  // Forest patch — northwest area
  const fCX = 13, fCY = 12;
  for (let y = fCY - 6; y <= fCY + 6; y++) {
    for (let x = fCX - 7; x <= fCX + 7; x++) {
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      const dx = (x - fCX) / 7, dy = (y - fCY) / 6;
      const d  = Math.sqrt(dx * dx + dy * dy) + noise(x + 10, y + 10) * 0.3;
      if (d <= 1.0 && map[y][x] >= T.GRASS_LIGHT) {
        map[y][x] = d < 0.65 ? T.FOREST : T.FOREST_EDGE;
      }
    }
  }

  // Forest clearing — sacred grove (inside the forest)
  for (let y = fCY - 1; y <= fCY + 1; y++) {
    for (let x = fCX - 2; x <= fCX + 2; x++) {
      if (map[y]?.[x] !== undefined) map[y][x] = T.GRASS_LIGHT;
    }
  }

  // Cave entrance — west side
  const cEX = 7, cEY = 18;
  for (let y = cEY - 2; y <= cEY + 2; y++) {
    for (let x = cEX - 3; x <= cEX + 3; x++) {
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      if (map[y][x] < T.SHALLOW) continue;
      const isWall = (y === cEY - 2 || y === cEY + 2 || x === cEX - 3 || x === cEX + 3);
      const isDoor = (x >= cEX - 1 && x <= cEX + 1 && y === cEY + 2);
      map[y][x] = (isWall && !isDoor) ? T.CAVE_WALL : T.CAVE_FLOOR;
    }
  }
  // Cave interior extending further west (off the island into cave walls)
  for (let y = cEY - 1; y <= cEY + 1; y++) {
    for (let x = cEX - 6; x <= cEX - 3; x++) {
      if (x < 0) continue;
      map[y][x] = x === cEX - 6 || y === cEY - 1 || y === cEY + 1 ? T.CAVE_WALL : T.CAVE_FLOOR;
    }
  }

  // Ruins — east of center
  const rX = 31, rY = 16;
  for (let y = rY - 3; y <= rY + 3; y++) {
    for (let x = rX - 4; x <= rX + 4; x++) {
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      if (map[y][x] < T.SHALLOW) continue;
      const wall = y === rY - 3 || y === rY + 3 || x === rX - 4 || x === rX + 4;
      // South doorway gap
      const door = (y === rY + 3 && x >= rX - 1 && x <= rX + 1);
      map[y][x] = (wall && !door) ? T.RUIN_WALL : T.RUIN_FLOOR;
    }
  }

  // Path — south beach → ruins
  // Vertical spine
  for (let y = 31; y >= rY + 4; y--) {
    const x = 24;
    if (map[y]?.[x] !== undefined && map[y][x] !== T.RUIN_WALL && map[y][x] !== T.FOREST) {
      map[y][x] = T.PATH;
    }
  }
  // Horizontal branch east to ruins south door
  for (let x = 24; x <= rX; x++) {
    const y = rY + 4;
    if (map[y]?.[x] !== undefined && map[y][x] !== T.RUIN_WALL) {
      map[y][x] = T.PATH;
    }
  }
  // Branch northwest to forest clearing
  for (let step = 0; step <= 10; step++) {
    const x = 24 - step;
    const y = 20 - step;
    if (y >= 0 && x >= 0 && map[y][x] !== T.FOREST && map[y][x] !== T.RUIN_WALL) {
      map[y][x] = T.PATH;
    }
  }

  return map;
}

// ── Interactables ─────────────────────────────────────────────────────────────

export const INTERACTABLES: Interactable[] = [
  {
    id: 'note_shore',
    tx: 24, ty: 31,
    range: 1.8,
    prompt: 'read the note',
    sprite: 'note',
    lines: [
      'A water-stained note, ink still holding:',
      '"If you find this — the island is real.',
      'Not everyone who drifts here stays lost.',
      'Some of us came to remember what quiet feels like."',
    ],
    discoveryId: 'note_shore',
  },
  {
    id: 'bottle',
    tx: 27, ty: 32,
    range: 1.8,
    prompt: 'open the bottle',
    sprite: 'bottle',
    lines: [
      'A green glass bottle, sealed with dark wax.',
      'Inside, a tiny rolled scroll:',
      '"The lighthouse hasn\'t been lit in forty years.',
      'But on clear nights, some swear they still see it."',
    ],
    discoveryId: 'bottle',
  },
  {
    id: 'driftwood',
    tx: 21, ty: 33,
    range: 1.8,
    prompt: 'rest on the driftwood',
    sprite: 'note',
    lines: [
      'A smooth grey log, worn by the sea.',
      'You sit. The water sounds different up close.',
      'Like it has nowhere to be, either.',
    ],
    discoveryId: 'driftwood',
  },
  {
    id: 'ruins_altar',
    tx: 31, ty: 16,
    range: 2.5,
    prompt: 'examine the altar',
    sprite: 'stone',
    lines: [
      'A low stone table, carved with spirals.',
      'Whatever was placed here is long gone.',
      'The stone is still warm. Strange.',
    ],
    discoveryId: 'ruins_altar',
  },
  {
    id: 'ruins_inscription',
    tx: 31, ty: 13,
    range: 2.0,
    prompt: 'read the inscription',
    sprite: 'note',
    lines: [
      'Carved into the north wall:',
      '"We built this for the days when the world',
      'felt too heavy to carry.',
      'Leave the weight here. It keeps fine."',
    ],
    discoveryId: 'ruins_inscription',
  },
  {
    id: 'grove_shrine',
    tx: 13, ty: 12,
    range: 2.0,
    prompt: 'approach the shrine',
    sprite: 'shrine',
    lines: [
      'A small cairn of carefully balanced stones.',
      'Moss grows over the lowest ones.',
      'A single dried flower rests on top — placed recently.',
      'Someone was here before you.',
    ],
    discoveryId: 'grove_shrine',
  },
  {
    id: 'cave_markings',
    tx: 4, ty: 18,
    range: 2.0,
    prompt: 'study the markings',
    sprite: 'stone',
    lines: [
      'Scratched into the cave wall: tally marks.',
      'You count them. Thirty-seven.',
      'Then a gap.',
      'Then, in different handwriting: "I stopped counting."',
    ],
    discoveryId: 'cave_markings',
  },
  {
    id: 'cave_pool',
    tx: 6, ty: 17,
    range: 1.8,
    prompt: 'look into the pool',
    sprite: 'stone',
    lines: [
      'A still underground pool, perfectly dark.',
      'Your face looks back at you.',
      'You look tired.',
      'You look okay.',
    ],
    discoveryId: 'cave_pool',
  },
  {
    id: 'old_fire',
    tx: 24, ty: 22,
    range: 2.0,
    prompt: 'examine the campfire',
    sprite: 'fire',
    lines: [
      'Cold ashes. Someone camped here not long ago.',
      'A small tin cup sits beside the ring of stones.',
      'Still has the smell of something warm.',
    ],
    discoveryId: 'old_fire',
  },
  {
    id: 'hilltop_view',
    tx: 24, ty: 11,
    range: 2.5,
    prompt: 'take in the view',
    sprite: 'note',
    lines: [
      'From here, you can see the whole island.',
      'The ruins to the east. The forest to the north.',
      'The sea all around, very still.',
      'It looks smaller than it felt.',
      'Most things do, from high enough up.',
    ],
    discoveryId: 'hilltop_view',
  },
];

// ── Discovery catalog ─────────────────────────────────────────────────────────

export const DISCOVERIES: Discovery[] = [
  { id: 'note_shore',       title: 'A note on the shore',      desc: 'Someone left a message in a bottle — for whoever needed it.',    symbol: '✉' },
  { id: 'bottle',           title: 'The lighthouse rumour',    desc: 'A bottle-sealed mystery about a light that should be dark.',      symbol: '⬡' },
  { id: 'driftwood',        title: 'The patient driftwood',    desc: 'You rested. The sea reminded you it has nowhere to be.',          symbol: '~' },
  { id: 'ruins_altar',      title: 'The warm altar',           desc: 'A stone table, still warm after all this time.',                  symbol: '□' },
  { id: 'ruins_inscription',title: 'Words in the wall',        desc: '"Leave the weight here. It keeps fine."',                        symbol: '∷' },
  { id: 'grove_shrine',     title: 'Someone was here',         desc: 'A cairn with a fresh flower. You are not the first wanderer.',    symbol: '▲' },
  { id: 'cave_markings',    title: 'The tally that stopped',   desc: 'Thirty-seven marks, then a different voice: "I stopped."',       symbol: '|' },
  { id: 'cave_pool',        title: 'The cave pool',            desc: 'You looked tired. You looked okay. Both were true.',              symbol: '◎' },
  { id: 'old_fire',         title: 'Cold ashes, warm cup',     desc: 'Someone else camped here once. Not long ago.',                   symbol: '△' },
  { id: 'hilltop_view',     title: 'The whole island',         desc: 'It looked smaller from up there. Most things do.',               symbol: '◇' },
];

// ── Infinite ocean — tiles beyond the fixed map ───────────────────────────────

export function outerTile(gx: number, gy: number): T {
  // Distance from the island's rectangular boundary
  const ox = gx < 0 ? -gx : gx >= WORLD_W ? gx - WORLD_W + 1 : 0;
  const oy = gy < 0 ? -gy : gy >= WORLD_H ? gy - WORLD_H + 1 : 0;
  const dist = Math.sqrt(ox * ox + oy * oy);

  // Immediate border is always deep water — no abrupt land
  if (dist < 3) return T.DEEP_WATER;

  // Deterministic archipelago further out — same every visit
  const nx = gx * 0.09 + 200, ny = gy * 0.09 + 200;
  const n =
    Math.sin(nx * 0.78 + ny * 0.52 + 12) * 0.50 +
    Math.sin(nx * 1.43 + ny * 1.10 + 87) * 0.30 +
    Math.cos(nx * 0.55 + ny * 0.83 + 44) * 0.20;

  // Threshold rises with distance — far-out islands are rarer
  const threshold = 0.52 + dist * 0.008;
  if (n > threshold + 0.18) return T.GRASS;
  if (n > threshold + 0.09) return T.GRASS_LIGHT;
  if (n > threshold + 0.02) return T.SAND;
  if (n > threshold - 0.03) return T.SHALLOW;
  if (n > threshold - 0.10) return T.WATER;
  return T.DEEP_WATER;
}

// ── Daily rotating content ────────────────────────────────────────────────────

export function dateHash(): number {
  const d   = new Date();
  const str = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h  = (h * 16777619) >>> 0;
  }
  return h;
}

const DAILY_POOL: Array<{ lines: string[]; spots: [number, number][] }> = [
  {
    lines: ['A damp page pinned to a stone.', '"I watched the tide for an hour today.', 'It did not watch back.', 'That was exactly what I needed."'],
    spots: [[22, 29], [26, 28], [20, 31]],
  },
  {
    lines: ['A folded note under a flat rock:', '"The bird that landed here this morning', 'stayed for four minutes.', 'I counted. It did not."'],
    spots: [[15, 24], [18, 26], [12, 27]],
  },
  {
    lines: ['Scratched in the sand — almost washed away:', '"Some days the island feels smaller.', 'Some days it goes on forever.', 'Today it was just right."'],
    spots: [[28, 31], [25, 33], [30, 30]],
  },
  {
    lines: ['A note curled around a small stone:', '"I used to think quiet was the absence of noise.', 'It is not.', 'It is the presence of something else."'],
    spots: [[8, 20], [6, 22], [10, 19]],
  },
  {
    lines: ['Tucked into a crack in the ruins wall:', '"I have been here before.', 'I will be here again.', 'That is not a sad thing."'],
    spots: [[33, 14], [29, 18], [34, 17]],
  },
  {
    lines: ['Written in the margin of a waterlogged map:', '"Every island looks tiny from far away.', 'That is a problem of perspective.', 'The island does not mind."'],
    spots: [[19, 22], [21, 20], [17, 25]],
  },
  {
    lines: ['Pinned to a branch at the grove edge:', '"The moss does not hurry.', 'The lichen does not worry.', 'There may be a lesson here."'],
    spots: [[11, 14], [14, 10], [16, 13]],
  },
  {
    lines: ['A torn page, folded into a boat shape:', '"Someone once told me that rest', 'is not something you earn.', 'I am still learning to believe them."'],
    spots: [[25, 29], [23, 32], [27, 30]],
  },
  {
    lines: ['Carved lightly into a cave wall:', '"Day 1: I arrived.', 'Day 2: I noticed things.', 'Day 3: That was enough."'],
    spots: [[5, 19], [4, 17], [7, 16]],
  },
  {
    lines: ['Floating offshore, caught on a rock:', '"The sea has been here longer than every word', 'I have ever worried about.', 'That helps."'],
    spots: [[24, 34], [28, 33], [20, 34]],
  },
];

export function getDailyNotes(): Interactable[] {
  const h   = dateHash();
  const out: Interactable[] = [];
  const used = new Set<number>();

  for (let slot = 0; slot < 3; slot++) {
    let idx = (h + slot * 7919) % DAILY_POOL.length;
    while (used.has(idx)) idx = (idx + 1) % DAILY_POOL.length;
    used.add(idx);

    const entry    = DAILY_POOL[idx];
    const spotIdx  = (h + slot * 1031) % entry.spots.length;
    const [tx, ty] = entry.spots[spotIdx];

    out.push({ id: `daily_${slot}`, tx, ty, range: 1.8, prompt: 'read the note', sprite: 'note', lines: entry.lines });
  }
  return out;
}

export type Atmosphere = 'clear' | 'fog' | 'mist' | 'rain' | 'golden';

export function getDailyAtmosphere(): Atmosphere {
  const roll = dateHash() % 10;
  if (roll === 0) return 'rain';
  if (roll <= 2)  return 'fog';
  if (roll === 3) return 'mist';
  if (roll === 4) return 'golden';
  return 'clear';
}

// ── Layer 2 — deeper secrets, unlocked after all base discoveries ─────────────

export const LAYER2_INTERACTABLES: Interactable[] = [
  {
    id: 'l2_tide_pool',
    tx: 18, ty: 34,
    range: 1.8,
    prompt: 'peer into the tide pool',
    sprite: 'stone',
    lines: [
      'Something is caught in the rock pool.',
      'A tiny crab. An orange peel.',
      'A brass button — very old.',
      'You leave them where you found them.',
    ],
    discoveryId: 'l2_tide_pool',
  },
  {
    id: 'l2_hollow_tree',
    tx: 10, ty: 11,
    range: 1.8,
    prompt: 'look inside the hollow',
    sprite: 'note',
    lines: [
      'At the base of the oldest tree: a hollow.',
      'Inside, a small tin box.',
      'Inside that: a list of names.',
      'No other context. Just names.',
      'You add yours, quietly, in your head.',
    ],
    discoveryId: 'l2_hollow_tree',
  },
  {
    id: 'l2_echo_stone',
    tx: 5, ty: 16,
    range: 2.0,
    prompt: 'tap the stone',
    sprite: 'stone',
    lines: [
      'A flat stone near the cave mouth.',
      'You tap it once.',
      'Three seconds later, from somewhere deep:',
      'the same sound, returned.',
    ],
    discoveryId: 'l2_echo_stone',
  },
  {
    id: 'l2_ruins_cellar',
    tx: 29, ty: 15,
    range: 2.0,
    prompt: 'descend the steps',
    sprite: 'stone',
    lines: [
      'Steps going down. You follow.',
      'A small room below the ruins.',
      'Empty except for light.',
      'No window — the light has no source.',
      'You stay until you feel ready to leave.',
    ],
    discoveryId: 'l2_ruins_cellar',
  },
  {
    id: 'l2_summit_cairn',
    tx: 24, ty: 9,
    range: 2.0,
    prompt: 'add a stone to the cairn',
    sprite: 'shrine',
    lines: [
      'Near the highest point: a cairn.',
      'You find a small stone nearby.',
      'You set it on top.',
      'It is the smallest thing.',
      'It counts.',
    ],
    discoveryId: 'l2_summit_cairn',
  },
];

// ── Spirit runes ──────────────────────────────────────────────────────────────
// Positions only visible/collectible in spirit mode

export interface RuneDef {
  kind: RuneKind;
  tx: number;
  ty: number;
  discoveryId: string;
  spellName: string;
  spellDesc: string;
  runeDesc: string;
}

export const RUNES: RuneDef[] = [
  {
    kind: 'fire',
    tx: 31, ty: 15,
    discoveryId: 'rune_fire',
    spellName: 'Fire Orb',
    spellDesc: 'A projectile of concentrated flame. Press [1] to cast.',
    runeDesc:  'The Fire Rune pulses with trapped heat. You feel it enter you like a held breath finally released.',
  },
  {
    kind: 'water',
    tx: 18, ty: 34,
    discoveryId: 'rune_water',
    spellName: 'Water Veil',
    spellDesc:  'A ward of still water. Wolves cannot enter its radius. Press [2] to cast.',
    runeDesc:   'The Water Rune hums at a frequency just below hearing. Something in the tide recognises it.',
  },
  {
    kind: 'earth',
    tx: 24, ty: 10,
    discoveryId: 'rune_earth',
    spellName: 'Earth Pulse',
    spellDesc:  'A shockwave through the ground. Knocks nearby wolves away. Press [3] to cast.',
    runeDesc:   'The Earth Rune is heavier than it looks. You feel the island shift slightly underfoot.',
  },
  {
    kind: 'wind',
    tx: 13, ty: 12,
    discoveryId: 'rune_wind',
    spellName: 'Wind Step',
    spellDesc:  'A burst of speed. Wolves cannot touch you while it lasts. Press [4] to cast.',
    runeDesc:   'The Wind Rune dissolves into you the moment you touch it. You feel lighter. The island exhales.',
  },
];

export const RUNE_DISCOVERIES: Discovery[] = [
  { id: 'rune_fire',  title: 'The Fire Rune',  desc: 'Trapped heat, waiting. You gave it somewhere to go.',          symbol: '🜂' },
  { id: 'rune_water', title: 'The Water Rune', desc: 'The tide knew it. You know it now too.',                        symbol: '🜄' },
  { id: 'rune_earth', title: 'The Earth Rune', desc: 'The island shifted when you took it. You noticed.',             symbol: '🜃' },
  { id: 'rune_wind',  title: 'The Wind Rune',  desc: 'It dissolved into you. You are a little less heavy now.',       symbol: '🜁' },
];

// ── Entity spawns ─────────────────────────────────────────────────────────────

export function spawnEntities(): Entity[] {
  const entities: Entity[] = [];
  let id = 0;

  // 5 deer on grass tiles, central island
  const deerSpots = [
    [26, 22], [22, 18], [28, 19], [20, 24], [30, 25],
  ];
  for (const [x, y] of deerSpots) {
    entities.push({
      id: `deer_${id++}`, kind: 'deer',
      x, y, vx: 0, vy: 0,
      phase: id * 1.37,
      state: 'idle', stateTimer: Math.floor(id * 47 % 180),
      alive: true,
    });
  }

  // 2 wolf packs near cave
  const wolfSpots = [[8, 17], [6, 19]];
  for (const [x, y] of wolfSpots) {
    entities.push({
      id: `wolf_${id++}`, kind: 'wolf',
      x, y, vx: 0, vy: 0,
      phase: id * 0.91,
      state: 'idle', stateTimer: 0,
      alive: true,
    });
  }

  // Spirit fox — near forest grove, only visible at night/spirit mode
  entities.push({
    id: 'fox_0', kind: 'fox',
    x: 14, y: 13, vx: 0, vy: 0,
    phase: 0.5,
    state: 'wander', stateTimer: 60,
    alive: true,
  });

  // Bird flocks (3 flocks, each is 5 birds)
  const flockCenters = [[16, 14], [11, 10], [20, 12]];
  for (let f = 0; f < 3; f++) {
    const [cx, cy] = flockCenters[f];
    for (let b = 0; b < 5; b++) {
      entities.push({
        id: `bird_${f}_${b}`, kind: 'bird',
        x: cx + (Math.sin(b * 1.2) * 1.5),
        y: cy + (Math.cos(b * 0.9) * 1.2),
        vx: 0, vy: 0,
        phase: b * 0.63 + f * 2.1,
        state: 'idle', stateTimer: f * 30 + b * 11,
        alive: true,
        flock: f,
      });
    }
  }

  return entities;
}

export const LAYER2_DISCOVERIES: Discovery[] = [
  { id: 'l2_tide_pool',    title: 'The tide pool',         desc: 'A brass button, an orange peel. You left them.',                  symbol: '○' },
  { id: 'l2_hollow_tree',  title: 'The list of names',     desc: 'Someone kept names here. You added yours in your head.',          symbol: '§' },
  { id: 'l2_echo_stone',   title: 'The echo',              desc: 'You tapped. Three seconds later, it answered.',                   symbol: '◉' },
  { id: 'l2_ruins_cellar', title: 'The sourceless light',  desc: 'A room under the ruins. Light with no window. You waited.',       symbol: '✦' },
  { id: 'l2_summit_cairn', title: 'One more stone',        desc: 'You added a stone to the cairn. The smallest act.',               symbol: '▴' },
];
