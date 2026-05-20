import { T, WORLD_W, WORLD_H } from './types';
import type { TileDef, Interactable, Discovery } from './types';

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
