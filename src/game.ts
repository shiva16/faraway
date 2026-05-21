import { T, WORLD_W, WORLD_H } from './types';
import type { TileDef, Player, Interactable, SaveState, Entity, RuneKind, ActiveSpell, BuildingKind, Unit, ResourceKind } from './types';
import {
  TILE_DEFS, buildWorld, INTERACTABLES, DISCOVERIES,
  outerTile, getDailyNotes, getDailyAtmosphere,
  LAYER2_INTERACTABLES, LAYER2_DISCOVERIES,
  RUNES, RUNE_DISCOVERIES, spawnEntities,
} from './world';
import type { Atmosphere } from './world';
import {
  BUILDING_DEFS, RESOURCE_NODES, SHIP_PARTS,
  TECH_DEFS, ITEM_DEFS, NPC_DEFS, RANDOM_EVENTS,
  canAfford, deductCost, resourceColor, resourceIcon,
} from './building';
import { queueTrain, tickTrainQueue, updateUnits, trainQueue } from './units';
import { SPECIES, getSpecies } from './botany';
import { THREATS, STARTING_THREAT } from './threats';
import {
  ForestZone, ZoneStability, ZONE_SIZE,
  makeZone, tickZone,
} from './ecology';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCALE      = 3;              // screen px per world px
const TILE       = 16;             // world px per tile
const TILE_PX    = TILE * SCALE;   // 48 screen px per tile
const SPEED      = 0.07;           // tiles per frame
const SAVE_EVERY = 120_000;        // ms between auto-saves

// ── Game state ────────────────────────────────────────────────────────────────

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let world: T[][];
let player: Player;
let save: SaveState;
let saveSha: string | null = null;
let onSave: (s: SaveState, sha: string | null) => Promise<string>;

const keys: Record<string, boolean> = {};
let eJustPressed  = false;
let fJustPressed  = false;
let spellKeyPress: RuneKind | null = null;

// Dialog
let dialogLines: string[]   = [];
let dialogPage               = 0;
let dialogActive             = false;
let dialogJustOpened         = false;

// Discoveries panel
let discPanelOpen            = false;

// Help panel
let helpPanelOpen            = false;
let hJustPressed             = false;

// Zone name banner
let zoneName                 = '';
let zoneNameTimer            = 0;
let lastZone                 = '';

// Save indicator
let saveStatus               = '';
let saveStatusTimer          = 0;
let lastAutoSave             = 0;

// Interactable proximity
let nearbyInteractable: Interactable | null = null;

// Daily rotating content + atmosphere
let dailyNotes: Interactable[] = [];
let atmosphere: Atmosphere     = 'clear';

// ── Spirit realm ──────────────────────────────────────────────────────────────
let spiritMode   = false;
let spiritAlpha  = 0;  // 0-1, animated blend

// ── Entities ─────────────────────────────────────────────────────────────────
let entities: Entity[] = [];

// ── Active spells ─────────────────────────────────────────────────────────────
let activeSpells: ActiveSpell[] = [];
let waterVeilTimer  = 0;    // frames remaining
let windStepTimer   = 0;
let spellCooldown   = 0;    // brief cooldown to avoid double-cast

// ── Essence ───────────────────────────────────────────────────────────────────
const ESSENCE_MAX    = 100;
let essenceFlash     = 0;   // red screen flash timer (wolf hit)

// ── Weather events ────────────────────────────────────────────────────────────
let lightningTimer      = 0;   // frames until next lightning check
let lightningFlash      = 0;   // flash frames remaining
let thunderScheduled    = false;
let whaleDone           = false;
let whaleTimer          = 0;   // frames until whale; 0 = not yet triggered
let whaleAnim           = 0;   // 0 = not active; >0 = frames remaining
let whaleX              = 0;
let whaleY              = 0;

// ── Ghost ship ────────────────────────────────────────────────────────────────
let ghostShipX  = -8.0;   // tile X (starts off-screen left)

// ── Units ─────────────────────────────────────────────────────────────────────
let units: Unit[]           = [];
let selectedUnits: string[] = [];

// ── Combat ────────────────────────────────────────────────────────────────────
const PLAYER_MAX_HP     = 100;
const PLAYER_MAX_HUNGER = 100;
const PLAYER_MAX_SANITY = 100;
let   attackCooldown    = 0;
let   attackFlash       = 0;
let   attackDirX        = 0;
let   attackDirY        = 1;
let   spaceJustPressed  = false;
let   deathFade         = 0;
let   isDead            = false;

// ── Enemy camp ────────────────────────────────────────────────────────────────
const CAMP_X            = 5;
const CAMP_Y            = 8;
let   raiders: Entity[] = [];
let   raidWarning       = 0;

// ── Panels ────────────────────────────────────────────────────────────────────
let   techPanelOpen     = false;
let   tJustPressed      = false;
let   inventoryOpen     = false;
let   iJustPressed      = false;
let   craftTarget: BuildingKind | null = null;

// ── Fog of war ────────────────────────────────────────────────────────────────
let   fogGrid: boolean[][] = [];
const FOG_REVEAL_RADIUS    = 5;

// ── Seasons ───────────────────────────────────────────────────────────────────
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

// ── Random events ─────────────────────────────────────────────────────────────
let   pendingEvent: typeof RANDOM_EVENTS[0] | null = null;
let   eventBannerTimer  = 0;
let   lastDayCount      = 0;

// ── Sanity shadows ────────────────────────────────────────────────────────────
const SHADOWS = Array.from({ length: 6 }, (_, i) => ({
  x: Math.sin(i * 1.1) * 0.4 + 0.5, y: Math.cos(i * 0.9) * 0.4 + 0.5, phase: i * 0.7,
}));

// ── NPC state ─────────────────────────────────────────────────────────────────
let npcsActive: string[] = [];

// ── Forest restoration state ───────────────────────────────────────────────────
let plantMode           = false;
let selectedSpeciesId: string | null = null;
let pJustPressed        = false;
let forestZones         = new Map<string, ForestZone>();
let prevZoneStability   = new Map<string, ZoneStability>();
let lastGlvDay          = -1;   // tracks which day GLV was last stepped
let speciesPanelPage    = 0;       // pagination for species catalogue
let biodiversityIndex   = 0;       // 0–100, recalculated each second
let educationPopup: { lines: string[]; timer: number } | null = null;
let SPECIES_PER_PAGE    = 6;

// ── Build mode ────────────────────────────────────────────────────────────────
let buildMode           = false;
let selectedBuildKind: BuildingKind | null = null;
let mouseScreenX        = 0;
let mouseScreenY        = 0;
let bJustPressed        = false;

// ── Gathering animation ───────────────────────────────────────────────────────
let gatherFlash: { kind: ResourceKind; amount: number; sx: number; sy: number; timer: number } | null = null;

// ── Era banner ────────────────────────────────────────────────────────────────
let eraBannerText   = '';
let eraBannerTimer  = 0;

// ── Escape / victory ──────────────────────────────────────────────────────────
let escapePhase     = 0;   // 0=none 1=fade 2=victory
let escapeFade      = 0;   // 0-1
let shipCraftMenuOpen = false;

// ── Dock craft panel ──────────────────────────────────────────────────────────
let nearDock        = false;

// Rain particles (screen-space, animated by wavePhase)
const RAINDROPS = Array.from({ length: 200 }, (_, i) => ({
  x:     Math.sin(i * 1.37) * 0.5 + 0.5,
  y:     Math.cos(i * 0.91) * 0.5 + 0.5,
  speed: 8 + (Math.sin(i * 2.1) * 0.5 + 0.5) * 6,
}));

// Day/night cycle — time in minutes (0–1440)
let dayTime      = 7 * 60; // start at 7am
let lastRealTime = 0;

// Ambient audio context
let audioCtx: AudioContext | null = null;
let oceanGain: GainNode | null    = null;

// ── Tile helpers ─────────────────────────────────────────────────────────────

function tileAt(tx: number, ty: number): T {
  const x = Math.floor(tx), y = Math.floor(ty);
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return outerTile(x, y);
  return world[y][x];
}

function passable(tx: number, ty: number): boolean {
  return TILE_DEFS[tileAt(tx, ty)]?.passable ?? false;
}

// ── Day/night palette ─────────────────────────────────────────────────────────

function skyColor(): string {
  const t = dayTime;
  if (t < 360)  return '#0c1020'; // midnight-5am  — deep night
  if (t < 390)  return '#1a1830'; // 5am-6:30      — pre-dawn
  if (t < 420)  return '#2d2040'; // 6:30-7        — dawn purple
  if (t < 450)  return '#8b4020'; // 7-7:30        — sunrise orange
  if (t < 510)  return '#c87030'; // 7:30-8:30     — morning gold
  if (t < 720)  return '#4a6080'; // 8:30-noon     — clear morning
  if (t < 900)  return '#3a5070'; // noon-3pm      — afternoon
  if (t < 1020) return '#7a4828'; // 3pm-5pm       — evening orange
  if (t < 1080) return '#401828'; // 5pm-6pm       — dusk red
  if (t < 1140) return '#1a0c30'; // 6pm-7pm       — twilight
  return '#0c1020';               // after 7pm     — night
}

function lightOverlay(): { color: string; alpha: number } {
  const t = dayTime;
  if (t < 360 || t >= 1140) return { color: '#000', alpha: 0.48 };   // deep night
  if (t < 420)  return { color: '#000', alpha: 0.30 };                // pre-dawn
  if (t < 450)  return { color: '#c86820', alpha: 0.15 };             // sunrise warm
  if (t < 510)  return { color: '#c88030', alpha: 0.08 };             // morning glow
  if (t < 900)  return { color: '#000', alpha: 0 };                   // daytime — clear
  if (t < 1020) return { color: '#8b4010', alpha: 0.12 };             // evening warm
  if (t < 1080) return { color: '#401018', alpha: 0.28 };             // dusk
  return { color: '#000', alpha: 0.42 };                              // night falling
}

// ── Camera ────────────────────────────────────────────────────────────────────

function worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
  const camX = player.x * TILE_PX - canvas.width  / 2;
  const camY = player.y * TILE_PX - canvas.height / 2;
  return { sx: wx * TILE_PX - camX, sy: wy * TILE_PX - camY };
}

// ── Tile rendering ────────────────────────────────────────────────────────────

let wavePhase = 0;

function drawTile(tx: number, ty: number, sx: number, sy: number, def: TileDef) {
  // Checkerboard variation for texture
  const alt = (tx + ty) % 2 === 0;
  let color = alt && def.alt ? def.alt : def.base;

  // Animate water tiles
  if (def.wet) {
    const wave = Math.sin(wavePhase + tx * 0.6 + ty * 0.4) * 0.5 + 0.5;
    // Slightly shift luminosity
    const shift = Math.floor(wave * 8) - 4;
    color = shiftLightness(color, shift);
  }

  ctx.fillStyle = color;
  ctx.fillRect(sx, sy, TILE_PX, TILE_PX);

  // Dark overlay for forest interior and cave
  if (def.dark) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
  }
}

function shiftLightness(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawWorld() {
  const startX = Math.floor(player.x - canvas.width  / 2 / TILE_PX) - 1;
  const startY = Math.floor(player.y - canvas.height / 2 / TILE_PX) - 1;
  const endX   = startX + Math.ceil(canvas.width  / TILE_PX) + 3;
  const endY   = startY + Math.ceil(canvas.height / TILE_PX) + 3;

  for (let ty = startY; ty <= endY; ty++) {
    for (let tx = startX; tx <= endX; tx++) {
      const t   = tileAt(tx, ty);
      const def = TILE_DEFS[t] ?? TILE_DEFS[T.DEEP_WATER];
      const { sx, sy } = worldToScreen(tx, ty);
      drawTile(tx, ty, sx, sy, def);
    }
  }
}

// ── Interactable sprites ──────────────────────────────────────────────────────

function drawInteractableSprites() {
  const layer2Active = save.discoveries.length >= DISCOVERIES.length;
  const allObjs: Interactable[] = [
    ...INTERACTABLES,
    ...dailyNotes,
    ...(layer2Active ? LAYER2_INTERACTABLES : []),
  ];
  for (const obj of allObjs) {
    if (save.flags[`used_${obj.id}`] && obj.id !== 'hilltop_view') continue;
    const { sx, sy } = worldToScreen(obj.tx, obj.ty);
    if (sx < -TILE_PX || sx > canvas.width + TILE_PX) continue;
    if (sy < -TILE_PX || sy > canvas.height + TILE_PX) continue;

    const cx = sx + TILE_PX / 2;
    const cy = sy + TILE_PX / 2;
    const s  = SCALE;

    switch (obj.sprite) {
      case 'bottle': {
        ctx.fillStyle = '#4a8b5a';
        ctx.fillRect(cx - 3*s, cy - 4*s, 6*s, 8*s);
        ctx.fillStyle = '#2d5a3a';
        ctx.fillRect(cx - 2*s, cy - 6*s, 4*s, 3*s);
        ctx.fillStyle = '#c8a050';
        ctx.fillRect(cx - 1*s, cy - 7*s, 2*s, 1*s);
        break;
      }
      case 'note': {
        ctx.fillStyle = '#d4c89a';
        ctx.fillRect(cx - 4*s, cy - 5*s, 8*s, 10*s);
        ctx.fillStyle = '#8b7a5a';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(cx - 2*s, cy - 3*s + i*3*s, 4*s, s);
        }
        break;
      }
      case 'stone': {
        ctx.fillStyle = '#6b6058';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 5*s, 4*s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a4038';
        ctx.beginPath();
        ctx.ellipse(cx - s, cy - s, 3*s, 2.5*s, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'fire': {
        const flicker = Math.sin(wavePhase * 4 + obj.tx) * 0.5 + 0.5;
        ctx.fillStyle = `rgb(${180 + Math.floor(flicker * 40)},${80 + Math.floor(flicker * 30)},20)`;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2*s, 3*s, 4*s + flicker*s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c8c8b0';
        ctx.fillRect(cx - 4*s, cy + 2*s, 8*s, s);
        break;
      }
      case 'shrine': {
        // Stacked stones
        for (let i = 0; i < 4; i++) {
          const w = (4 - i) * 2 * s;
          ctx.fillStyle = i % 2 === 0 ? '#7a6a58' : '#6a5a48';
          ctx.fillRect(cx - w/2, cy + (i - 3) * 2*s - s, w, 2*s);
        }
        break;
      }
      default:
        ctx.fillStyle = '#c8b870';
        ctx.fillRect(cx - 2*s, cy - 2*s, 4*s, 4*s);
    }

    // Pulse ring when player is near
    if (nearbyInteractable?.id === obj.id) {
      const pulse = (Math.sin(wavePhase * 3) * 0.3 + 0.7);
      ctx.strokeStyle = `rgba(220,190,100,${pulse * 0.8})`;
      ctx.lineWidth   = s;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_PX * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ── Player rendering ──────────────────────────────────────────────────────────

function drawPlayer() {
  const { sx, sy } = worldToScreen(player.x - 0.5, player.y - 1);
  const s  = SCALE;
  const cx = sx + TILE_PX / 2;
  const cy = sy + TILE_PX / 2 + 4 * s;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10 * s, 6 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak body
  ctx.fillStyle = '#3d2e1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * s, 7 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak highlight
  ctx.fillStyle = '#5a4228';
  ctx.beginPath();
  ctx.ellipse(cx - s, cy - s, 4 * s, 6 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Hood
  ctx.fillStyle = '#1e150a';
  ctx.beginPath();
  ctx.arc(cx, cy - 7 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Face direction
  const faceOff = {
    down:  { x:  0, y:  2 * s },
    up:    { x:  0, y: -1 * s },
    left:  { x: -2 * s, y: s },
    right: { x:  2 * s, y: s },
  }[player.dir];

  // Face skin
  ctx.fillStyle = '#c8905a';
  ctx.beginPath();
  ctx.ellipse(cx + faceOff.x, cy - 6 * s + faceOff.y, 3 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (only if facing down/left/right, not up)
  if (player.dir !== 'up') {
    ctx.fillStyle = '#1a0800';
    const eyeSpread = player.dir === 'down' ? 1.2 * s : 0.8 * s;
    const eyeY      = cy - 7 * s + faceOff.y;
    ctx.fillRect(cx + faceOff.x - eyeSpread - s * 0.5, eyeY, s, s);
    ctx.fillRect(cx + faceOff.x + eyeSpread - s * 0.5, eyeY, s, s);
  }

  // Walk bob
  if (player.moving) {
    const bob = Math.sin(player.frame * Math.PI / 2) * s;
    ctx.fillStyle = '#2a1e10';
    const legY = cy + 9 * s - bob;
    ctx.fillRect(cx - 4 * s, legY, 3 * s, 3 * s);
    ctx.fillRect(cx + s,     legY + (bob > 0 ? s : -s), 3 * s, 3 * s);
  }
}

// ── Resource node rendering ──────────────────────────────────────────────────

function drawResourceNodes() {
  for (const node of RESOURCE_NODES) {
    const depleted = (save.flags[`dep_${node.id}`] as number | boolean | undefined);
    if (depleted === true) continue;  // legacy bool
    const depletedUntil = typeof depleted === 'number' ? depleted : 0;
    const isDepleted = depletedUntil > Date.now();

    const { sx, sy } = worldToScreen(node.tx, node.ty);
    if (sx < -TILE_PX || sx > canvas.width + TILE_PX) continue;
    const cx = sx + TILE_PX / 2;
    const cy = sy + TILE_PX / 2;
    const s  = SCALE;

    if (isDepleted) {
      // Faded stump/empty rock
      ctx.globalAlpha = 0.3;
    }

    if (node.kind === 'wood') {
      // Tree
      ctx.fillStyle = isDepleted ? '#4a3820' : '#2a5c18';
      ctx.beginPath();
      ctx.arc(cx, cy - 4 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      if (!isDepleted) {
        ctx.fillStyle = '#1e4510';
        ctx.beginPath();
        ctx.arc(cx - s, cy - 5 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isDepleted ? '#3a2810' : '#5a3818';
      ctx.fillRect(cx - s * 1.5, cy + s, s * 3, 5 * s);

    } else if (node.kind === 'stone') {
      // Rock cluster
      ctx.fillStyle = isDepleted ? '#4a4848' : '#7a7070';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isDepleted) {
        ctx.fillStyle = '#5a5858';
        ctx.beginPath();
        ctx.ellipse(cx - 2 * s, cy - s, 3 * s, 2.5 * s, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Sparkle
        ctx.fillStyle = '#c8c8d8';
        ctx.fillRect(cx + 2 * s, cy - 2 * s, s, s);
      }

    } else if (node.kind === 'food') {
      // Fishing spot — water shimmer + fish silhouette
      if (!isDepleted) {
        const shimmer = Math.sin(wavePhase * 3 + node.tx * 0.5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(60,180,220,${0.3 + shimmer * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fish shape
        ctx.fillStyle = '#204878';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 4 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 3 * s, cy);
        ctx.lineTo(cx - 6 * s, cy - 2 * s);
        ctx.lineTo(cx - 6 * s, cy + 2 * s);
        ctx.fill();
      }

    } else if (node.kind === 'coin') {
      // Artifact/coin pile
      if (!isDepleted) {
        ctx.fillStyle = '#806020';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s, 5 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glint
        const glint = Math.sin(wavePhase * 4 + node.tx) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,220,60,${0.5 + glint * 0.5})`;
        ctx.beginPath();
        ctx.arc(cx + s, cy - s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // Gather prompt when nearby
    const dx = player.x - node.tx, dy = player.y - node.ty;
    if (!isDepleted && Math.sqrt(dx * dx + dy * dy) < 1.8) {
      const yieldBonus = save.buildings.some(b => b.kind === 'forge') ? ' (+50%)' : '';
      const prompt = `[ E ] ${node.label}${yieldBonus}`;
      const pw = prompt.length * 8 + 24;
      const px2 = canvas.width / 2 - pw / 2;
      const py2 = canvas.height - 54;
      ctx.fillStyle   = 'rgba(0,0,0,0.65)';
      ctx.fillRect(px2, py2, pw, 28);
      const col = resourceColor(node.kind);
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.strokeRect(px2, py2, pw, 28);
      ctx.fillStyle   = '#d4c890';
      ctx.font        = '12px "Courier New", monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(prompt, canvas.width / 2, py2 + 18);
      ctx.textAlign   = 'left';
    }
  }
}

// ── Building rendering ────────────────────────────────────────────────────────

function drawBuildings() {
  for (const b of save.buildings) {
    const { sx, sy } = worldToScreen(b.tx, b.ty);
    if (sx < -TILE_PX * 2 || sx > canvas.width + TILE_PX * 2) continue;
    const cx = sx + TILE_PX / 2;
    const cy = sy + TILE_PX / 2;
    const s  = SCALE;
    drawBuildingSprite(b.kind, cx, cy, s, false);
  }
}

function drawBuildingSprite(kind: BuildingKind, cx: number, cy: number, s: number, ghost: boolean) {
  ctx.globalAlpha = ghost ? 0.55 : 1.0;
  switch (kind) {
    case 'shelter': {
      // Simple hut
      ctx.fillStyle = '#6b4828';
      ctx.fillRect(cx - 7 * s, cy, 14 * s, 10 * s);
      ctx.fillStyle = '#4a3018';
      ctx.beginPath();
      ctx.moveTo(cx - 9 * s, cy);
      ctx.lineTo(cx, cy - 10 * s);
      ctx.lineTo(cx + 9 * s, cy);
      ctx.fill();
      ctx.fillStyle = '#2a1808';
      ctx.fillRect(cx - 2 * s, cy + 3 * s, 4 * s, 7 * s);
      break;
    }
    case 'workshop': {
      // Larger building with chimney hint
      ctx.fillStyle = '#5a4830';
      ctx.fillRect(cx - 9 * s, cy - 2 * s, 18 * s, 13 * s);
      ctx.fillStyle = '#3a3020';
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, cy - 2 * s);
      ctx.lineTo(cx, cy - 13 * s);
      ctx.lineTo(cx + 10 * s, cy - 2 * s);
      ctx.fill();
      ctx.fillStyle = '#2a2010';
      ctx.fillRect(cx - 3 * s, cy + 2 * s, 6 * s, 9 * s);
      // Chimney
      ctx.fillStyle = '#4a4030';
      ctx.fillRect(cx + 4 * s, cy - 15 * s, 3 * s, 6 * s);
      break;
    }
    case 'forge': {
      // Stone structure with orange glow
      ctx.fillStyle = '#4a4038';
      ctx.fillRect(cx - 8 * s, cy - s, 16 * s, 11 * s);
      ctx.fillStyle = '#2a2828';
      ctx.beginPath();
      ctx.moveTo(cx - 9 * s, cy - s);
      ctx.lineTo(cx, cy - 10 * s);
      ctx.lineTo(cx + 9 * s, cy - s);
      ctx.fill();
      // Glowing forge mouth
      const glow = Math.sin(wavePhase * 3) * 0.5 + 0.5;
      ctx.fillStyle = `rgb(${180 + Math.floor(glow * 40)},${80 + Math.floor(glow * 30)},20)`;
      ctx.fillRect(cx - 3 * s, cy + 2 * s, 6 * s, 5 * s);
      break;
    }
    case 'signal_fire': {
      // Tall pole with fire
      ctx.fillStyle = '#5a4828';
      ctx.fillRect(cx - s, cy - 10 * s, 2 * s, 18 * s);
      ctx.fillRect(cx - 6 * s, cy + 4 * s, 12 * s, 2 * s);
      const flicker = Math.sin(wavePhase * 5) * 0.5 + 0.5;
      ctx.fillStyle = `rgb(${200 + Math.floor(flicker * 55)},${60 + Math.floor(flicker * 60)},10)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 12 * s, 4 * s, 6 * s + flicker * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Orange halo
      const grad = ctx.createRadialGradient(cx, cy - 12 * s, 0, cx, cy - 12 * s, 14 * s);
      grad.addColorStop(0, `rgba(255,120,0,${0.3 * flicker})`);
      grad.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy - 12 * s, 14 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dock': {
      // Pier extending downward
      ctx.fillStyle = '#6b5030';
      ctx.fillRect(cx - 12 * s, cy - 2 * s, 24 * s, 6 * s);
      // Pier posts
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = '#4a3820';
        ctx.fillRect(cx + i * 5 * s - s, cy + 4 * s, 2 * s, 8 * s);
      }
      // Platform
      ctx.fillStyle = '#7a6040';
      ctx.fillRect(cx - 10 * s, cy - 4 * s, 20 * s, 3 * s);
      // If ship parts assembled, show small boat
      if (save.shipParts.length === 3) {
        ctx.fillStyle = '#4a3818';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c8c8a0';
        ctx.fillRect(cx - s, cy + 3 * s, 2 * s, 8 * s);
        ctx.beginPath();
        ctx.moveTo(cx - s, cy + 3 * s);
        ctx.lineTo(cx + 7 * s, cy + 7 * s);
        ctx.lineTo(cx - s, cy + 11 * s);
        ctx.fill();
      }
      break;
    }
    case 'tree_nursery': {
      // Small greenhouse frame + seedling rows
      ctx.fillStyle = '#3a5820';
      ctx.fillRect(cx - 8 * s, cy - 2 * s, 16 * s, 10 * s);
      ctx.fillStyle = '#a0c860';
      ctx.fillRect(cx - 7 * s, cy - 1 * s, 14 * s, 8 * s);
      // Roof arch
      ctx.fillStyle = '#5a8030';
      ctx.beginPath();
      ctx.arc(cx, cy - 2 * s, 8 * s, Math.PI, 0);
      ctx.fill();
      // Seedlings
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = '#28600a';
        ctx.beginPath();
        ctx.arc(cx + i * 2.5 * s, cy + 3 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a3818';
        ctx.fillRect(cx + i * 2.5 * s - 0.5 * s, cy + 4.5 * s, s, 2 * s);
      }
      break;
    }
    case 'seed_bank': {
      // Bunker-style vault
      ctx.fillStyle = '#4a4838';
      ctx.fillRect(cx - 9 * s, cy, 18 * s, 9 * s);
      // Arched roof
      ctx.fillStyle = '#3a3828';
      ctx.beginPath();
      ctx.arc(cx, cy, 9 * s, Math.PI, 0);
      ctx.fill();
      // Door
      ctx.fillStyle = '#6a5828';
      ctx.fillRect(cx - 3 * s, cy + 2 * s, 6 * s, 7 * s);
      // Vault wheel
      ctx.strokeStyle = '#c8a840';
      ctx.lineWidth = s * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy + 5 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let a = 0; a < 4; a++) {
        ctx.moveTo(cx, cy + 5 * s);
        ctx.lineTo(cx + Math.cos(a * Math.PI / 2) * 2.5 * s, cy + 5 * s + Math.sin(a * Math.PI / 2) * 2.5 * s);
      }
      ctx.stroke();
      break;
    }
    case 'ranger_station': {
      // Watchtower on stilts
      ctx.fillStyle = '#5a4020';
      for (let i = -1; i <= 1; i += 2) {
        ctx.fillRect(cx + i * 5 * s - s, cy + 2 * s, 2 * s, 10 * s);
      }
      // Platform
      ctx.fillStyle = '#6b5028';
      ctx.fillRect(cx - 7 * s, cy, 14 * s, 3 * s);
      // Cabin
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(cx - 6 * s, cy - 8 * s, 12 * s, 9 * s);
      // Roof
      ctx.fillStyle = '#3a2810';
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, cy - 8 * s);
      ctx.lineTo(cx, cy - 14 * s);
      ctx.lineTo(cx + 8 * s, cy - 8 * s);
      ctx.fill();
      // Lookout window
      ctx.fillStyle = '#c8e8a0';
      ctx.fillRect(cx - 3 * s, cy - 7 * s, 6 * s, 4 * s);
      break;
    }
    case 'water_catchment': {
      // Raised cistern/tank
      ctx.fillStyle = '#3a5868';
      ctx.fillRect(cx - 8 * s, cy - 4 * s, 16 * s, 12 * s);
      // Water shimmer inside
      const wShimmer = Math.sin(wavePhase * 2) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(60,160,200,${0.5 + wShimmer * 0.3})`;
      ctx.fillRect(cx - 7 * s, cy - 3 * s, 14 * s, 10 * s);
      // Rim
      ctx.strokeStyle = '#5a8890';
      ctx.lineWidth = s;
      ctx.strokeRect(cx - 8 * s, cy - 4 * s, 16 * s, 12 * s);
      // Collection pipe
      ctx.fillStyle = '#2a4858';
      ctx.fillRect(cx - s, cy + 8 * s, 2 * s, 4 * s);
      break;
    }
    case 'myco_lab': {
      // Low round structure with mycelium glow
      ctx.fillStyle = '#302818';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2 * s, 9 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dome
      ctx.fillStyle = '#403828';
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * s, Math.PI, 0);
      ctx.fill();
      // Mycelium glow vents
      const mycoGlow = Math.sin(wavePhase * 1.5) * 0.5 + 0.5;
      for (let i = -1; i <= 1; i++) {
        const grad = ctx.createRadialGradient(cx + i * 4 * s, cy + 2 * s, 0, cx + i * 4 * s, cy + 2 * s, 3 * s);
        grad.addColorStop(0, `rgba(180,255,120,${0.6 + mycoGlow * 0.3})`);
        grad.addColorStop(1, 'rgba(180,255,120,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx + i * 4 * s, cy + 2 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.globalAlpha = 1;
}

// ── Build mode overlay ────────────────────────────────────────────────────────

function drawBuildMode() {
  if (!buildMode) return;

  // Ghost preview at mouse position
  if (selectedBuildKind) {
    const tx = Math.floor(mouseScreenX / TILE_PX + player.x - canvas.width / 2 / TILE_PX);
    const ty = Math.floor(mouseScreenY / TILE_PX + player.y - canvas.height / 2 / TILE_PX);
    const tile = tileAt(tx, ty);
    const def  = TILE_DEFS[tile];
    const def2 = BUILDING_DEFS.find(d => d.kind === selectedBuildKind)!;
    const valid = def?.passable && tile !== 0 && tile !== 1 && tile !== 2
      && !save.buildings.some(b => b.tx === tx && b.ty === ty);

    const { sx, sy } = worldToScreen(tx, ty);
    ctx.fillStyle = valid ? 'rgba(80,200,80,0.3)' : 'rgba(200,60,60,0.3)';
    ctx.fillRect(sx, sy, TILE_PX * def2.size, TILE_PX * def2.size);
    drawBuildingSprite(selectedBuildKind, sx + TILE_PX / 2, sy + TILE_PX / 2, SCALE, true);
    ctx.strokeStyle = valid ? 'rgba(80,200,80,0.7)' : 'rgba(200,60,60,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, TILE_PX * def2.size, TILE_PX * def2.size);
  }

  // ── Numbered build panel (right side) ──────────────────────────────────────
  const ROW_H = 26, PAD = 10;
  const PW = 272, PH = BUILDING_DEFS.length * ROW_H + 58;
  const PX = canvas.width - PW - 14;
  const PY = (canvas.height - PH) / 2;

  ctx.fillStyle = 'rgba(4,3,1,0.95)';
  ctx.fillRect(PX, PY, PW, PH);
  ctx.strokeStyle = '#5a4020';
  ctx.lineWidth = 2;
  ctx.strokeRect(PX, PY, PW, PH);

  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BUILD  MODE', PX + PW / 2, PY + PAD + 10);
  ctx.fillStyle = '#4a3820';
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText('keys 1–9, 0  ·  Enter = place here', PX + PW / 2, PY + PAD + 24);
  ctx.textAlign = 'left';

  let ry = PY + 40;
  for (let idx = 0; idx < BUILDING_DEFS.length; idx++) {
    const def = BUILDING_DEFS[idx];
    const affordable = canAfford(save.resources, def.cost);
    const alreadyBuilt = def.unique && save.buildings.some(b => b.kind === def.kind);
    const active = selectedBuildKind === def.kind;
    const keyLabel = idx < 9 ? `[${idx + 1}]` : '[0]';

    ctx.fillStyle = active
      ? 'rgba(100,78,18,0.9)'
      : alreadyBuilt
        ? 'rgba(24,22,12,0.7)'
        : affordable
          ? 'rgba(36,28,10,0.8)'
          : 'rgba(16,14,8,0.5)';
    ctx.fillRect(PX + PAD, ry, PW - PAD * 2, ROW_H - 2);

    ctx.strokeStyle = active ? '#d4a820' : alreadyBuilt ? '#2a2410' : affordable ? '#5a4018' : '#2a2010';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(PX + PAD, ry, PW - PAD * 2, ROW_H - 2);

    // Key badge
    ctx.fillStyle = active ? '#d4a820' : affordable && !alreadyBuilt ? '#a08030' : '#403820';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillText(keyLabel, PX + PAD + 4, ry + 16);

    // Building name
    ctx.fillStyle = alreadyBuilt ? '#504838' : affordable ? '#d4c880' : '#604830';
    ctx.font = (active ? 'bold ' : '') + '10px "Courier New", monospace';
    ctx.fillText(def.label, PX + PAD + 28, ry + 16);

    // Cost or status
    if (alreadyBuilt) {
      ctx.fillStyle = '#3a3020';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('built', PX + PW - PAD - 2, ry + 16);
    } else {
      const cp: string[] = [];
      if (def.cost.wood  > 0) cp.push(`${def.cost.wood}W`);
      if (def.cost.stone > 0) cp.push(`${def.cost.stone}S`);
      if (def.cost.food  > 0) cp.push(`${def.cost.food}F`);
      if (def.cost.coin  > 0) cp.push(`${def.cost.coin}C`);
      ctx.fillStyle = affordable ? '#a08030' : '#502818';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(cp.join(' '), PX + PW - PAD - 2, ry + 16);
    }
    ctx.textAlign = 'left';
    ry += ROW_H;
  }

  // Footer
  if (selectedBuildKind) {
    const selDef = BUILDING_DEFS.find(d => d.kind === selectedBuildKind)!;
    ctx.fillStyle = '#7ad860';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${selDef.label} — Enter to place at feet`, PX + PW / 2, PY + PH - 9);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#3a3020';
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[Esc] cancel  ·  click map to place', PX + PW / 2, PY + PH - 9);
    ctx.textAlign = 'left';
  }
}

// ── Ship craft panel ──────────────────────────────────────────────────────────

function drawShipCraftPanel() {
  if (!shipCraftMenuOpen) return;

  const W = 340, H = 240, PAD = 16;
  const X = (canvas.width - W) / 2;
  const Y = (canvas.height - H) / 2;

  ctx.fillStyle   = 'rgba(6,4,1,0.96)';
  ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#4a6888';
  ctx.lineWidth = 2;
  ctx.strokeRect(X, Y, W, H);

  ctx.fillStyle  = '#80aad0';
  ctx.font       = 'bold 13px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('DOCK  —  BUILD YOUR SHIP', X + W / 2, Y + PAD + 12);
  ctx.textAlign  = 'left';

  let ry = Y + PAD + 30;
  for (const part of SHIP_PARTS) {
    const done = save.shipParts.includes(part.id);
    ctx.fillStyle = done ? 'rgba(20,40,20,0.8)' : 'rgba(20,20,30,0.8)';
    ctx.fillRect(X + PAD, ry, W - PAD * 2, 46);
    ctx.strokeStyle = done ? '#40a840' : '#304860';
    ctx.lineWidth = 1;
    ctx.strokeRect(X + PAD, ry, W - PAD * 2, 46);

    ctx.fillStyle = done ? '#60c860' : '#c8d4e0';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText((done ? '✓  ' : '   ') + part.label, X + PAD + 10, ry + 16);
    ctx.fillStyle = done ? '#408840' : '#607888';
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText(part.desc, X + PAD + 10, ry + 29);

    if (!done) {
      const affordable = canAfford(save.resources, part.cost);
      ctx.fillStyle = affordable ? '#a0c820' : '#604030';
      ctx.font = '10px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(affordable ? '[ E ] craft' : 'need resources', X + W - PAD - 8, ry + 22);
      ctx.textAlign = 'left';
    }
    ry += 54;
  }

  if (save.shipParts.length === SHIP_PARTS.length) {
    ctx.fillStyle = '#c8a020';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ E ] SET SAIL — leave the island', X + W / 2, Y + H - 16);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#405060';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ Esc ] close', X + W / 2, Y + H - 16);
    ctx.textAlign = 'left';
  }
}

// ── Victory screen ────────────────────────────────────────────────────────────

function drawVictory() {
  if (escapePhase === 0) return;

  if (escapePhase === 1) {
    // Fade to black
    ctx.fillStyle = `rgba(0,0,0,${escapeFade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Victory screen
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  drawStars();

  const W = 420, H = 300;
  const X = (canvas.width - W) / 2;
  const Y = (canvas.height - H) / 2;

  ctx.fillStyle   = 'rgba(5,12,25,0.95)';
  ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#4060a0';
  ctx.lineWidth = 2;
  ctx.strokeRect(X, Y, W, H);

  ctx.fillStyle = '#80c0ff';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('You escaped Faraway.', X + W / 2, Y + 50);

  ctx.fillStyle = '#4a7090';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('The sea was waiting. You were ready.', X + W / 2, Y + 72);

  const mins  = Math.floor(save.playTime / 60);
  const secs  = Math.floor(save.playTime % 60);
  const stats: Array<[string, string]> = [
    ['Time on the island', `${mins}m ${secs}s`],
    ['Discoveries',        `${save.discoveries.length}`],
    ['Runes collected',    `${save.collectedRunes.length} / 4`],
    ['Buildings erected',  `${save.buildings.length}`],
    ['Era reached',        save.era === 3 ? 'Ready to Sail' : save.era === 2 ? 'Settled' : 'Stranded'],
  ];

  let sy = Y + 110;
  for (const [label, val] of stats) {
    ctx.fillStyle = '#405870';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, X + 40, sy);
    ctx.fillStyle = '#c0d8f0';
    ctx.textAlign = 'right';
    ctx.fillText(val, X + W - 40, sy);
    sy += 22;
  }

  ctx.fillStyle = '#304060';
  ctx.strokeStyle = '#405880';
  ctx.lineWidth = 1;
  ctx.fillRect(X + 40, Y + H - 56, 150, 30);
  ctx.strokeRect(X + 40, Y + H - 56, 150, 30);
  ctx.fillStyle = '#a0c8e0';
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[ R ] Sail back', X + 115, Y + H - 36);

  ctx.fillStyle = '#203040';
  ctx.strokeStyle = '#304860';
  ctx.fillRect(X + W - 190, Y + H - 56, 150, 30);
  ctx.strokeRect(X + W - 190, Y + H - 56, 150, 30);
  ctx.fillStyle = '#607888';
  ctx.fillText('[ N ] New island', X + W - 115, Y + H - 36);
  ctx.textAlign = 'left';
}

// ── Era banner ────────────────────────────────────────────────────────────────

function drawEraBanner() {
  if (eraBannerTimer <= 0) return;
  const alpha = Math.min(1, eraBannerTimer / 40) * Math.min(1, (eraBannerTimer - 20) / 20 + 1);
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalAlpha = clampedAlpha;
  ctx.fillStyle   = 'rgba(0,0,0,0.75)';
  const tw = eraBannerText.length * 10 + 40;
  ctx.fillRect(canvas.width / 2 - tw / 2, canvas.height / 2 - 30, tw, 40);
  ctx.strokeStyle = '#c8a020';
  ctx.lineWidth   = 2;
  ctx.strokeRect(canvas.width / 2 - tw / 2, canvas.height / 2 - 30, tw, 40);
  ctx.fillStyle   = '#d4a853';
  ctx.font        = 'bold 16px "Courier New", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(eraBannerText, canvas.width / 2, canvas.height / 2 - 5);
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

// ── Gather flash ──────────────────────────────────────────────────────────────

function drawGatherFlash() {
  if (!gatherFlash) return;
  const { kind, amount, sx, sy, timer } = gatherFlash;
  const alpha = timer / 60;
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = resourceColor(kind);
  ctx.font        = 'bold 14px "Courier New", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(`+${amount} ${resourceIcon(kind)}`, sx, sy - (1 - alpha) * 20);
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

// ── Resource HUD ──────────────────────────────────────────────────────────────

function drawResourceHUD() {
  const kinds: Array<ResourceKind> = ['wood', 'stone', 'food', 'coin'];
  const labels = ['W', 'S', 'F', 'C'];
  const W = 48, H = 22, PAD = 4;
  const startX = 14;
  const startY = 46;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(startX, startY, kinds.length * (W + PAD) - PAD, H);

  kinds.forEach((kind, i) => {
    const x = startX + i * (W + PAD);
    const val = save.resources[kind];
    ctx.fillStyle = resourceColor(kind);
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText(`${labels[i]}:${val}`, x + 4, startY + 15);
  });

  // Era indicator
  const eraLabels = ['', 'Stranded', 'Settled', 'Ready to Sail'];
  const eraColors = ['', '#608048', '#80a840', '#40a0c8'];
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(startX, startY + H + 4, 150, 18);
  ctx.fillStyle = eraColors[save.era];
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText(`Era: ${eraLabels[save.era]}`, startX + 6, startY + H + 16);
}

// ── Spirit realm overlay ─────────────────────────────────────────────────────

function drawSpiritOverlay() {
  if (spiritAlpha <= 0) return;
  // Deep indigo tint
  ctx.fillStyle   = `rgba(30,10,80,${spiritAlpha * 0.42})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Luminescent shimmer on water tiles
  const startX = Math.floor(player.x - canvas.width  / 2 / TILE_PX) - 1;
  const startY = Math.floor(player.y - canvas.height / 2 / TILE_PX) - 1;
  const endX   = startX + Math.ceil(canvas.width  / TILE_PX) + 3;
  const endY   = startY + Math.ceil(canvas.height / TILE_PX) + 3;
  for (let ty = startY; ty <= endY; ty++) {
    for (let tx = startX; tx <= endX; tx++) {
      const t = tileAt(tx, ty);
      if (t !== T.WATER && t !== T.SHALLOW && t !== T.DEEP_WATER && t !== T.SHALLOW_DARK) continue;
      const { sx, sy } = worldToScreen(tx, ty);
      const glow = (Math.sin(wavePhase * 1.4 + tx * 0.5 + ty * 0.3) * 0.5 + 0.5);
      ctx.fillStyle = `rgba(80,160,255,${spiritAlpha * glow * 0.22})`;
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
    }
  }
}

function drawRunes() {
  for (const rune of RUNES) {
    if (save.collectedRunes.includes(rune.kind)) continue;
    // Runes only visible in spirit mode
    const vis = spiritAlpha;
    if (vis < 0.05) continue;
    const { sx, sy } = worldToScreen(rune.tx, rune.ty);
    if (sx < -TILE_PX || sx > canvas.width + TILE_PX) continue;
    const cx = sx + TILE_PX / 2;
    const cy = sy + TILE_PX / 2;
    const s  = SCALE;
    const pulse = (Math.sin(wavePhase * 2.2 + rune.tx) * 0.5 + 0.5);
    const color: Record<RuneKind, string> = {
      fire: '#ff6030', water: '#30aaff', earth: '#60cc40', wind: '#ffffa0',
    };
    ctx.globalAlpha = vis * (0.7 + pulse * 0.3);
    // Glow halo
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_PX * 0.8);
    grad.addColorStop(0, color[rune.kind]);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE_PX * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Core glyph — diamond
    ctx.fillStyle = color[rune.kind];
    ctx.save();
    ctx.translate(cx, cy - 2 * s);
    ctx.rotate(Math.PI / 4 + wavePhase * 0.5);
    ctx.fillRect(-3 * s, -3 * s, 6 * s, 6 * s);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Collection prompt if player is close in spirit mode
    const dx = player.x - rune.tx, dy = player.y - rune.ty;
    if (spiritMode && Math.sqrt(dx * dx + dy * dy) < 1.8) {
      const nameMap: Record<RuneKind, string> = { fire: 'Fire', water: 'Water', earth: 'Earth', wind: 'Wind' };
      const prompt = `[ E ] claim the ${nameMap[rune.kind]} Rune`;
      const pw = prompt.length * 8 + 24;
      const px2 = canvas.width / 2 - pw / 2;
      const py2 = canvas.height - 54;
      ctx.fillStyle  = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px2, py2, pw, 28);
      ctx.strokeStyle = color[rune.kind];
      ctx.lineWidth   = 1;
      ctx.strokeRect(px2, py2, pw, 28);
      ctx.fillStyle   = color[rune.kind];
      ctx.font        = '12px "Courier New", monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(prompt, canvas.width / 2, py2 + 18);
      ctx.textAlign   = 'left';
    }
  }
}

// ── Entity rendering ──────────────────────────────────────────────────────────

function drawEntities() {
  const isNight = dayTime < 420 || dayTime >= 1020;
  for (const e of entities) {
    if (!e.alive) continue;
    if (e.kind === 'wolf' && !isNight) continue;   // wolves only at night
    if (e.kind === 'fox'  && !isNight && spiritAlpha < 0.1) continue; // fox: night or spirit

    const { sx, sy } = worldToScreen(e.x - 0.5, e.y - 0.5);
    const cx = sx + TILE_PX / 2;
    const cy = sy + TILE_PX / 2;
    const s  = SCALE;

    if (e.kind === 'deer') {
      const bob = Math.sin(wavePhase * 3 + e.phase) * (e.state === 'flee' ? 1.5 * s : 0.5 * s);
      // Body
      ctx.fillStyle = '#8b6040';
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.arc(cx + 4 * s, cy - 2 * s + bob, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#6b4828';
      for (let i = 0; i < 4; i++) {
        const lx = cx + (i < 2 ? -3 : 3) * s;
        const ly = cy + 3 * s + Math.sin(wavePhase * 6 + e.phase + i) * (e.state === 'flee' ? 2 * s : 0.5 * s);
        ctx.fillRect(lx - s * 0.5, ly, s, 3 * s);
      }
      // Antlers (simple V)
      ctx.strokeStyle = '#4a3020';
      ctx.lineWidth = s * 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + 4 * s, cy - 4 * s + bob);
      ctx.lineTo(cx + 2 * s, cy - 8 * s + bob);
      ctx.moveTo(cx + 4 * s, cy - 4 * s + bob);
      ctx.lineTo(cx + 6 * s, cy - 8 * s + bob);
      ctx.stroke();

    } else if (e.kind === 'bird') {
      const flap = Math.sin(wavePhase * 8 + e.phase) * 2 * s;
      ctx.fillStyle = e.state === 'flee' ? '#888890' : '#707888';
      // Wings
      ctx.beginPath();
      ctx.ellipse(cx - 2 * s, cy + flap, 3 * s, s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 2 * s, cy - flap, 3 * s, s, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#505868';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();

    } else if (e.kind === 'wolf') {
      const prowl = Math.sin(wavePhase * 2 + e.phase) * 0.5 * s;
      // Eerie glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8 * s);
      grad.addColorStop(0, 'rgba(80,0,120,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#1e1428';
      ctx.beginPath();
      ctx.ellipse(cx, cy + prowl, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#2a1e38';
      ctx.beginPath();
      ctx.arc(cx + 5 * s, cy - 2 * s + prowl, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Eyes — red
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(cx + 4 * s, cy - 3 * s + prowl, s, s);
      ctx.fillRect(cx + 6.5 * s, cy - 3 * s + prowl, s, s);
      // Legs
      ctx.fillStyle = '#150e20';
      for (let i = 0; i < 4; i++) {
        const lx = cx + (i < 2 ? -4 : 2) * s;
        const lphase = wavePhase * 5 + e.phase + i * 0.7;
        ctx.fillRect(lx, cy + 3 * s + Math.sin(lphase) * 1.5 * s, s, 3 * s);
      }

    } else if (e.kind === 'fox') {
      const glow = Math.sin(wavePhase * 1.8 + e.phase) * 0.5 + 0.5;
      ctx.globalAlpha = 0.5 + glow * 0.4;
      // Ethereal glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 * s);
      grad.addColorStop(0, `rgba(255,200,80,${0.4 * glow})`);
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#e07820';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#f09030';
      ctx.beginPath();
      ctx.arc(cx + 4 * s, cy - s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = '#c06018';
      ctx.beginPath();
      ctx.moveTo(cx + 3 * s, cy - 3 * s);
      ctx.lineTo(cx + 2 * s, cy - 7 * s);
      ctx.lineTo(cx + 5 * s, cy - 4 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 5 * s, cy - 3 * s);
      ctx.lineTo(cx + 7 * s, cy - 7 * s);
      ctx.lineTo(cx + 7 * s, cy - 3 * s);
      ctx.fill();
      // Bushy tail
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 6 * s, cy + s, 4 * s, 2 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ── Spell effects rendering ────────────────────────────────────────────────────

function drawSpellEffects() {
  for (const sp of activeSpells) {
    if (sp.kind === 'fire' && sp.ox !== undefined) {
      const { sx, sy } = worldToScreen(sp.ox!, sp.oy!);
      const s  = SCALE;
      const cx = sx, cy = sy;
      // Orb core
      const flicker = Math.sin(wavePhase * 10) * 0.5 + 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 * s);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#ffaa20');
      grad.addColorStop(0.5, `rgba(255,60,0,${0.6 + flicker * 0.3})`);
      grad.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Water veil — ring around player
  if (waterVeilTimer > 0) {
    const { sx, sy } = worldToScreen(player.x, player.y);
    const alpha = Math.min(1, waterVeilTimer / 30) * 0.5;
    const r     = 3 * TILE_PX;
    const grad  = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r);
    grad.addColorStop(0, `rgba(60,160,255,0)`);
    grad.addColorStop(0.7, `rgba(60,160,255,${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(100,200,255,${alpha})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    // Animated ring
    ctx.strokeStyle = `rgba(100,200,255,${alpha * 1.5})`;
    ctx.lineWidth   = SCALE;
    ctx.beginPath();
    ctx.arc(sx, sy, r + Math.sin(wavePhase * 3) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Wind step — speed trail
  if (windStepTimer > 0) {
    const { sx, sy } = worldToScreen(player.x, player.y);
    const alpha = Math.min(1, windStepTimer / 20) * 0.6;
    for (let i = 1; i <= 4; i++) {
      const bx = sx - player.x * 0 + (player.dir === 'left' ? i * 8 : player.dir === 'right' ? -i * 8 : 0);
      const by = sy + (player.dir === 'up' ? i * 8 : player.dir === 'down' ? -i * 8 : 0);
      ctx.fillStyle = `rgba(200,255,200,${alpha * (0.4 - i * 0.08)})`;
      ctx.beginPath();
      ctx.arc(bx, by, (5 - i) * SCALE, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Ghost ship ────────────────────────────────────────────────────────────────

function drawGhostShip() {
  if (atmosphere !== 'fog') return;
  const { sx, sy } = worldToScreen(ghostShipX, 6);
  if (sx > canvas.width + 200 || sx < -200) return;
  const s = SCALE;
  ctx.globalAlpha = 0.18 + Math.sin(wavePhase * 0.3) * 0.06;
  ctx.fillStyle   = '#b0c8d0';
  // Hull
  ctx.beginPath();
  ctx.moveTo(sx - 12 * s, sy + 3 * s);
  ctx.lineTo(sx + 14 * s, sy + 3 * s);
  ctx.lineTo(sx + 10 * s, sy + 6 * s);
  ctx.lineTo(sx - 10 * s, sy + 6 * s);
  ctx.closePath();
  ctx.fill();
  // Mast
  ctx.fillRect(sx - s, sy - 12 * s, s, 15 * s);
  // Sail
  ctx.beginPath();
  ctx.moveTo(sx - s, sy - 12 * s);
  ctx.lineTo(sx + 9 * s, sy - 5 * s);
  ctx.lineTo(sx - s, sy + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Whale breach ──────────────────────────────────────────────────────────────

function drawWhale() {
  if (whaleAnim <= 0) return;
  const progress = 1 - whaleAnim / 160;   // 0→1 over 160 frames
  const arc = Math.sin(progress * Math.PI); // 0→1→0
  const { sx, sy } = worldToScreen(whaleX, whaleY - arc * 3.5);
  const s = SCALE;
  ctx.globalAlpha = arc * 0.9;
  // Body
  ctx.fillStyle = '#2a4858';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 14 * s, 5 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(sx - 12 * s, sy + s);
  ctx.lineTo(sx - 18 * s, sy - 4 * s);
  ctx.lineTo(sx - 14 * s, sy - 2 * s);
  ctx.lineTo(sx - 18 * s, sy + 6 * s);
  ctx.closePath();
  ctx.fill();
  // Splash particles
  if (arc > 0.6) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI + Math.PI * 0.2;
      const dist  = (arc - 0.6) * 5 * TILE_PX * (0.5 + Math.sin(i * 1.3) * 0.5);
      ctx.fillStyle = `rgba(160,200,230,${(1 - arc) * 0.7})`;
      ctx.beginPath();
      ctx.arc(
        sx + Math.cos(angle) * dist,
        sy + Math.sin(angle) * dist * 0.4,
        (3 - (arc - 0.6) * 4) * s, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Atmosphere effects ────────────────────────────────────────────────────────

function drawAtmosphere() {
  switch (atmosphere) {
    case 'fog': {
      ctx.fillStyle = 'rgba(190,200,210,0.20)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.18,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.72,
      );
      grad.addColorStop(0, 'rgba(190,200,210,0)');
      grad.addColorStop(1, 'rgba(190,200,210,0.42)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
    case 'mist': {
      ctx.fillStyle = 'rgba(210,220,230,0.11)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
    case 'rain': {
      ctx.strokeStyle = 'rgba(155,175,210,0.32)';
      ctx.lineWidth   = 1;
      for (const drop of RAINDROPS) {
        const sx = ((drop.x + wavePhase * 0.018) % 1) * canvas.width;
        const sy = ((drop.y + wavePhase * drop.speed * 0.0018) % 1) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 1, sy + 9);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,120,175,0.07)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
    case 'golden': {
      ctx.fillStyle = 'rgba(210,165,35,0.09)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
  }
}

// ── UI ─────────────────────────────────────────────────────────────────────────

function drawZoneBanner() {
  if (zoneNameTimer <= 0) return;
  const alpha = Math.min(1, zoneNameTimer / 30) * Math.min(1, (zoneNameTimer) / 30);
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(zoneName).width + 32;
  ctx.fillRect(canvas.width / 2 - w / 2, 28, w, 28);
  ctx.fillStyle   = '#d4c890';
  ctx.font        = '14px "Courier New", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(zoneName, canvas.width / 2, 47);
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

function drawInteractPrompt() {
  if (!nearbyInteractable || dialogActive || discPanelOpen) return;
  const prompt = `[ E ] ${nearbyInteractable.prompt}`;
  const w = prompt.length * 8 + 24;
  const x = canvas.width / 2 - w / 2;
  const y = canvas.height - 54;

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x, y, w, 28);
  ctx.strokeStyle = 'rgba(200,170,80,0.5)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y, w, 28);
  ctx.fillStyle   = '#d4c890';
  ctx.font        = '12px "Courier New", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(prompt, canvas.width / 2, y + 18);
  ctx.textAlign   = 'left';
}

function drawDialog() {
  if (!dialogActive) return;
  const PAD  = 32, BH = 160, BY = canvas.height - BH - 24;
  const BW   = canvas.width - PAD * 2;

  ctx.fillStyle   = 'rgba(8,6,2,0.92)';
  ctx.fillRect(PAD, BY, BW, BH);
  ctx.strokeStyle = '#5a4828';
  ctx.lineWidth   = 2;
  ctx.strokeRect(PAD, BY, BW, BH);

  const lines = dialogLines[dialogPage]?.split('\n') ?? [];
  ctx.fillStyle   = '#d4c890';
  ctx.font        = '13px "Courier New", monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, PAD + 18, BY + 28 + i * 22);
  });

  const hasMore = dialogPage < dialogLines.length - 1;
  ctx.fillStyle  = '#7a6838';
  ctx.font       = '11px "Courier New", monospace';
  ctx.textAlign  = 'right';
  ctx.fillText(hasMore ? '[ E ] continue' : '[ E ] close', PAD + BW - 14, BY + BH - 12);
  ctx.textAlign  = 'left';
}

function drawDiscoveries() {
  if (!discPanelOpen) return;

  const layer2Active = save.discoveries.length >= DISCOVERIES.length;
  const allDiscs     = layer2Active
    ? [...DISCOVERIES, ...LAYER2_DISCOVERIES, ...RUNE_DISCOVERIES]
    : DISCOVERIES;
  const found        = allDiscs.filter(d => save.discoveries.includes(d.id));
  const W = 300, PAD = 20;
  const headerH = layer2Active ? 68 : 52;
  const H = Math.min(found.length * 44 + headerH, canvas.height - 80);
  const X = (canvas.width - W) / 2;
  const Y = (canvas.height - H) / 2;

  ctx.fillStyle   = 'rgba(8,6,2,0.95)';
  ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#5a4828';
  ctx.lineWidth   = 2;
  ctx.strokeRect(X, Y, W, H);

  ctx.fillStyle   = '#d4a853';
  ctx.font        = 'bold 13px "Courier New", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(`DISCOVERIES  ${found.length}/${allDiscs.length}`, X + W / 2, Y + 28);

  if (layer2Active) {
    ctx.fillStyle = '#8a6830';
    ctx.font      = '10px "Courier New", monospace';
    ctx.fillText('✦  deeper secrets revealed  ✦', X + W / 2, Y + 46);
  }

  ctx.textAlign = 'left';
  found.forEach((d, i) => {
    const ry = Y + headerH + i * 44;
    ctx.fillStyle  = '#3a2e18';
    ctx.fillRect(X + PAD, ry, W - PAD * 2, 36);
    ctx.fillStyle  = '#c8a050';
    ctx.font       = '16px "Courier New", monospace';
    ctx.fillText(d.symbol, X + PAD + 10, ry + 23);
    ctx.fillStyle  = '#d4c890';
    ctx.font       = '12px "Courier New", monospace';
    ctx.fillText(d.title, X + PAD + 34, ry + 14);
    ctx.fillStyle  = '#7a6838';
    ctx.font       = '10px "Courier New", monospace';
    ctx.fillText(d.desc.length > 42 ? d.desc.slice(0, 42) + '…' : d.desc, X + PAD + 34, ry + 28);
  });

  if (found.length === 0) {
    ctx.fillStyle = '#4a3d20';
    ctx.font      = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Nothing discovered yet. Keep wandering.', X + W / 2, Y + H / 2);
  }

  ctx.fillStyle  = '#4a3d20';
  ctx.font       = '10px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('[ Tab ] close', X + W / 2, Y + H - 12);
  ctx.textAlign  = 'left';
}

function drawHelp() {
  if (!helpPanelOpen) return;

  const W = 380, PAD = 18;
  const sections: Array<{ heading: string; rows: Array<[string, string]> }> = [
    {
      heading: 'MOVEMENT',
      rows: [
        ['WASD / Arrow keys', 'Move'],
        ['Walk into water',   'Wade (shallows only)'],
      ],
    },
    {
      heading: 'ACTIONS',
      rows: [
        ['E',   'Interact / gather resource / collect rune'],
        ['B',   'Open build mode (place buildings)'],
        ['Tab', 'Open discoveries journal'],
        ['F',   'Toggle Spirit Realm'],
        ['Esc', 'Close any panel / cancel build'],
      ],
    },
    {
      heading: 'SPELLS  (collect runes first)',
      rows: [
        ['1', 'Fire Orb — projectile, destroys a wolf'],
        ['2', 'Water Veil — 4s ward, wolves keep back'],
        ['3', 'Earth Pulse — shockwave knocks wolves away'],
        ['4', 'Wind Step — 3s sprint, wolves can\'t touch you'],
      ],
    },
    {
      heading: 'THE ISLAND',
      rows: [
        ['Sacred Grove (NW)',  'Forest clearing — shrine, Wind Rune'],
        ['The Ruins (E)',      'Stone hall — altar, Fire Rune hidden inside'],
        ['The Cave (W)',       'Dark cave — tally marks, echo stone'],
        ['Hilltop (N-centre)', 'Overlook of the whole island'],
        ['Shore (S)',          'Driftwood, bottle, note — start here'],
        ['Spirit mode (F)',    'Runes glow; fox leads you to uncollected ones'],
      ],
    },
    {
      heading: 'GATHERING (press E near nodes)',
      rows: [
        ['Trees (forest edge)',  'Wood  — needed for most buildings'],
        ['Rocks (cave area)',    'Stone — needed for forge + dock'],
        ['Shore/shallows',       'Food  — needed for ship sail'],
        ['Ruins artifacts',      'Coin  — needed for forge + compass'],
      ],
    },
    {
      heading: 'ESCAPE GOAL',
      rows: [
        ['1. Gather resources',  'Explore and press E near nodes'],
        ['2. Build Shelter+WS',  'Advances to Era II (Settled)'],
        ['3. Build the Dock',    'Press B → Dock → click shore tile'],
        ['4. Craft 3 ship parts','Press E near Dock → craft all'],
        ['5. Set Sail',          'Leave the island. You\'re free.'],
      ],
    },
    {
      heading: 'SURVIVAL  (read this first if you keep dying)',
      rows: [
        ['Hunger bar drops', 'to 0 → HP drains fast. Rest often.'],
        ['E near Shelter',   'Full heal + +50 hunger. Set respawn point.'],
        ['Food nodes',       'E at dark shore rocks / fish pools'],
        ['Night + wolves',   'Sanity drains. Stay near fire or shelter.'],
        ['Signal Fire',      'Build one. Stops night sanity drain.'],
        ['B → 1 → Enter',   'Place Shelter at your feet immediately'],
        ['Space bar',        'Attack. Fight raiders, wolves, threat camps'],
        ['R after death',    'Respawn at last shelter (lose 20% resources)'],
      ],
    },
    {
      heading: 'RESTORATION  (the main game)',
      rows: [
        ['P key',            'Open species catalogue — pick a plant'],
        ['Click grass/forest','Plant selected species there'],
        ['Pioneers first',   'Acacia, Birch, Leucaena — plant on bare ground'],
        ['Add 3+ species',   'Zone becomes THRIVING (green shimmer)'],
        ['Combat threats',   'Space near threat camp to chip away HP'],
        ['Carbon Credits',   'Earned by planting. Needed for rare species'],
      ],
    },
    {
      heading: 'BUILD MODE  (B key)',
      rows: [
        ['Keys 1–9, 0',     'Select building instantly (no clicking)'],
        ['Enter',           'Place selected building at your feet'],
        ['Click map',       'Place building at mouse position'],
        ['Shelter first',   'Must have shelter + workshop for Era II'],
      ],
    },
    {
      heading: 'TIPS',
      rows: [
        ['Night',          'Wolves emerge; Spirit Fox appears'],
        ['Fog days',       'Ghost ship drifts offshore'],
        ['Forge built',    '+50% on all resource gathering'],
        ['Spirit mode (F)','Reveals hidden runes → spells'],
      ],
    },
  ];

  // Measure total height
  let totalH = PAD * 2 + 14; // top title
  for (const sec of sections) {
    totalH += 22 + sec.rows.length * 18 + 8;
  }
  totalH += 18; // footer
  totalH = Math.min(totalH, canvas.height - 60);

  const X = (canvas.width - W) / 2;
  const Y = (canvas.height - totalH) / 2;

  ctx.fillStyle   = 'rgba(6,4,1,0.96)';
  ctx.fillRect(X, Y, W, totalH);
  ctx.strokeStyle = '#5a4828';
  ctx.lineWidth   = 2;
  ctx.strokeRect(X, Y, W, totalH);

  ctx.fillStyle  = '#d4a853';
  ctx.font       = 'bold 13px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('FARAWAY  —  HOW TO PLAY', X + W / 2, Y + PAD + 12);

  let rowY = Y + PAD + 30;
  for (const sec of sections) {
    ctx.fillStyle  = '#8a6830';
    ctx.font       = 'bold 10px "Courier New", monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(sec.heading, X + PAD, rowY);
    rowY += 16;
    for (const [key, desc] of sec.rows) {
      ctx.fillStyle = 'rgba(30,22,8,0.7)';
      ctx.fillRect(X + PAD, rowY - 12, W - PAD * 2, 16);
      ctx.fillStyle = '#c8a050';
      ctx.font      = '11px "Courier New", monospace';
      ctx.fillText(key, X + PAD + 6, rowY);
      ctx.fillStyle = '#9a8860';
      ctx.fillText(desc, X + PAD + 148, rowY);
      rowY += 18;
    }
    rowY += 8;
  }

  ctx.fillStyle  = '#4a3d20';
  ctx.font       = '10px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('[ H ] or [ ? ] or [ Esc ] close', X + W / 2, Y + totalH - 10);
  ctx.textAlign  = 'left';
}

function drawEssenceBar() {
  const BAR_W = 120, BAR_H = 8;
  const bx = canvas.width / 2 - BAR_W / 2;
  const by = canvas.height - 22;
  const pct = save.essence / ESSENCE_MAX;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 4, by - 4, BAR_W + 8, BAR_H + 8);

  // Fill — color shifts as essence depletes
  const r = Math.floor(40 + (1 - pct) * 160);
  const g = Math.floor(100 * pct);
  const b = Math.floor(180 + 30 * pct);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(bx, by, BAR_W * pct, BAR_H);

  // Label
  ctx.fillStyle  = 'rgba(200,220,255,0.5)';
  ctx.font       = '9px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('essence', canvas.width / 2, by - 4);
  ctx.textAlign  = 'left';

  // Spell icons (unlocked runes, left of essence bar)
  const runeColors: Record<RuneKind, string> = {
    fire: '#ff6030', water: '#30aaff', earth: '#60cc40', wind: '#ffff80',
  };
  const runeKeys: Array<[RuneKind, string]> = [
    ['fire', '1'], ['water', '2'], ['earth', '3'], ['wind', '4'],
  ];
  runeKeys.forEach(([kind, key], i) => {
    if (!save.collectedRunes.includes(kind)) return;
    const ix = bx - 30 - i * 28;
    const iy = by - 4;
    const canCast = save.essence >= SPELL_COSTS[kind];
    ctx.fillStyle = canCast ? runeColors[kind] : 'rgba(100,100,100,0.5)';
    ctx.fillRect(ix, iy, 20, 16);
    ctx.fillStyle = '#000';
    ctx.font      = '8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(key, ix + 10, iy + 11);
    ctx.textAlign = 'left';
  });
}

function drawSpiritHUD() {
  if (spiritAlpha < 0.05) return;
  // Spirit mode indicator top-center
  ctx.globalAlpha = spiritAlpha;
  ctx.fillStyle   = 'rgba(30,10,80,0.7)';
  const label = '✦  SPIRIT REALM  ✦';
  const tw = label.length * 7.5 + 20;
  ctx.fillRect(canvas.width / 2 - tw / 2, 10, tw, 22);
  ctx.fillStyle = '#c090ff';
  ctx.font      = '11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, canvas.width / 2, 25);
  ctx.textAlign  = 'left';
  ctx.globalAlpha = 1;
}

function drawHUD() {
  // Discovery count (top left)
  const n          = save.discoveries.length;
  const totalDiscs = n >= DISCOVERIES.length
    ? DISCOVERIES.length + LAYER2_DISCOVERIES.length + RUNE_DISCOVERIES.length
    : DISCOVERIES.length;
  ctx.fillStyle  = 'rgba(0,0,0,0.5)';
  ctx.fillRect(14, 14, 120, 24);
  ctx.fillStyle  = '#7a6838';
  ctx.font       = '11px "Courier New", monospace';
  ctx.fillText(`◇ ${n}/${totalDiscs} found   [Tab]`, 22, 30);

  // Save status (top right)
  if (saveStatusTimer > 0) {
    const alpha = Math.min(1, saveStatusTimer / 20);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = 'rgba(0,0,0,0.5)';
    const tw = saveStatus.length * 7 + 20;
    ctx.fillRect(canvas.width - tw - 14, 14, tw, 24);
    ctx.fillStyle   = '#6a9850';
    ctx.font        = '11px "Courier New", monospace';
    ctx.fillText(saveStatus, canvas.width - tw - 4, 30);
    ctx.globalAlpha = 1;
  }

  // Time of day (bottom-right corner)
  const hours = Math.floor(dayTime / 60);
  const mins  = String(Math.floor(dayTime % 60)).padStart(2, '0');
  const ampm  = hours >= 12 ? 'pm' : 'am';
  const h12   = hours % 12 === 0 ? 12 : hours % 12;
  const timeStr = `${h12}:${mins}${ampm}`;
  const timeW   = timeStr.length * 7 + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvas.width - timeW - 12, canvas.height - 30, timeW, 22);
  ctx.fillStyle  = '#c8b060';
  ctx.font       = '11px "Courier New", monospace';
  ctx.textAlign  = 'right';
  ctx.fillText(timeStr, canvas.width - 18, canvas.height - 14);
  ctx.textAlign  = 'left';

  // Help button [?] (bottom-right, above time)
  ctx.fillStyle  = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvas.width - 36, canvas.height - 58, 28, 22);
  ctx.strokeStyle = 'rgba(180,150,60,0.5)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(canvas.width - 36, canvas.height - 58, 28, 22);
  ctx.fillStyle  = '#c8a050';
  ctx.font       = '12px "Courier New", monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('?', canvas.width - 22, canvas.height - 42);
  ctx.textAlign  = 'left';
}

// ── Night sky stars ────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (Math.sin(i * 0.73 + 1.2) * 0.5 + 0.5),
  y: (Math.cos(i * 1.21 + 0.8) * 0.5 + 0.5),
  r: 0.5 + (Math.sin(i * 2.3) * 0.5 + 0.5) * 1.2,
  twinkle: Math.sin(i * 0.93) * 2.3,
}));

function drawStars() {
  const t   = dayTime;
  let alpha = 0;
  if (t < 360 || t >= 1080)  alpha = 0.9;
  else if (t < 420) alpha = 1 - (t - 360) / 60;
  else if (t >= 1020) alpha = (t - 1020) / 60;
  if (alpha <= 0) return;

  ctx.globalAlpha = alpha;
  for (const s of STARS) {
    const twinkle = Math.sin(wavePhase * 1.5 + s.twinkle) * 0.3 + 0.7;
    ctx.fillStyle  = `rgba(255,250,220,${twinkle})`;
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height * 0.6, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Fireflies (at dusk/night near forest) ─────────────────────────────────────

const FIREFLIES = Array.from({ length: 12 }, (_, i) => ({
  x: 10 + (Math.sin(i * 1.4) * 0.5 + 0.5) * 10,
  y: 9  + (Math.cos(i * 1.1) * 0.5 + 0.5) * 8,
  phase: i * 0.78,
}));

function drawFireflies() {
  const t     = dayTime;
  let alpha   = 0;
  if (t >= 1020 && t < 1080) alpha = (t - 1020) / 60;
  else if (t >= 1080 || t < 420) alpha = 0.85;
  else if (t < 480) alpha = 1 - (t - 420) / 60;
  if (alpha <= 0.05) return;

  for (const ff of FIREFLIES) {
    const wobX = ff.x + Math.sin(wavePhase * 0.8 + ff.phase) * 0.6;
    const wobY = ff.y + Math.cos(wavePhase * 0.7 + ff.phase * 1.3) * 0.4;
    const { sx, sy } = worldToScreen(wobX, wobY);
    const glow  = (Math.sin(wavePhase * 2.5 + ff.phase) * 0.5 + 0.5);
    ctx.globalAlpha = alpha * glow * 0.9;
    ctx.fillStyle   = '#c8e850';
    ctx.beginPath();
    ctx.arc(sx, sy, 2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Glow halo
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * SCALE);
    grad.addColorStop(0, `rgba(180,220,30,${0.4 * glow})`);
    grad.addColorStop(1, 'rgba(180,220,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 6 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── Zone detection ────────────────────────────────────────────────────────────

function currentZone(): string {
  if (player.x < 0 || player.x >= WORLD_W || player.y < 0 || player.y >= WORLD_H) return 'Open Water';
  const t = tileAt(player.x, player.y);
  const dx = player.x - 13, dy = player.y - 12;
  if (Math.sqrt(dx*dx + dy*dy) < 5) return 'The Sacred Grove';
  const dx2 = player.x - 31, dy2 = player.y - 16;
  if (Math.sqrt(dx2*dx2 + dy2*dy2) < 6) return 'The Old Ruins';
  const dx3 = player.x - 7, dy3 = player.y - 18;
  if (Math.sqrt(dx3*dx3 + dy3*dy3) < 5) return 'The Cave';
  if (player.y > 27) return 'The Shore';
  if (t === T.FOREST || t === T.FOREST_EDGE) return 'The Forest';
  if (t === T.RUIN_FLOOR || t === T.RUIN_WALL) return 'The Ruins';
  if (t === T.CAVE_FLOOR || t === T.CAVE_WALL) return 'The Cave';
  if (t === T.SHALLOW || t === T.WATER) return 'Wading';
  if (t === T.SAND) return 'The Shore';
  if (player.y < 15 && player.x > 18 && player.x < 30) return 'High Ground';
  return '';
}

// ── Ambient audio ─────────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // Ocean: low-frequency noise
  oceanGain = audioCtx.createGain();
  oceanGain.gain.value = 0.06;
  oceanGain.connect(audioCtx.destination);

  const bufLen = audioCtx.sampleRate * 3;
  const buf    = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  // Low-pass filter
  const biquad = audioCtx.createBiquadFilter();
  biquad.type            = 'lowpass';
  biquad.frequency.value = 280;
  biquad.Q.value         = 0.5;
  biquad.connect(oceanGain);

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;
  src.connect(biquad);
  src.start();
}

export function playDiscoveryChime() {
  if (!audioCtx) return;
  const freqs = [523, 659, 784, 1047];
  freqs.forEach((f, i) => {
    const osc  = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.frequency.value = f;
    osc.type            = 'triangle';
    gain.gain.setValueAtTime(0, audioCtx!.currentTime + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.12, audioCtx!.currentTime + i * 0.12 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + i * 0.12 + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx!.destination);
    osc.start(audioCtx!.currentTime + i * 0.12);
    osc.stop(audioCtx!.currentTime + i * 0.12 + 0.7);
  });
}

// ── Interaction ───────────────────────────────────────────────────────────────

function openDialog(obj: Interactable) {
  dialogLines      = obj.lines.map(l => l);
  dialogPage       = 0;
  dialogActive     = true;
  dialogJustOpened = true;

  if (obj.discoveryId && !save.discoveries.includes(obj.discoveryId)) {
    save.discoveries.push(obj.discoveryId);
    playDiscoveryChime();
  }
  save.flags[`used_${obj.id}`] = true;
}

function advanceDialog() {
  if (!dialogActive) return;
  if (dialogPage < dialogLines.length - 1) {
    dialogPage++;
  } else {
    dialogActive = false;
  }
}

// ── Player movement ───────────────────────────────────────────────────────────

function movePlayer(dt: number) {
  if (dialogActive || discPanelOpen || helpPanelOpen || buildMode || escapePhase > 0) return;

  const up    = keys['ArrowUp']    || keys['w'] || keys['W'];
  const down  = keys['ArrowDown']  || keys['s'] || keys['S'];
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];

  let dx = 0, dy = 0;
  if (up)    dy -= 1;
  if (down)  dy += 1;
  if (left)  dx -= 1;
  if (right) dx += 1;

  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

  player.moving = dx !== 0 || dy !== 0;

  if (dx !== 0) player.dir = dx < 0 ? 'left' : 'right';
  if (dy !== 0) player.dir = dy < 0 ? 'up' : 'down';

  const windMult = windStepTimer > 0 ? 2.5 : 1;
  const spd   = SPEED * windMult * (dt / 16.67);
  const nx    = player.x + dx * spd;
  const ny    = player.y + dy * spd;
  const foot  = 0.35; // collision box half-width in tiles

  if (dx !== 0 && passable(nx + Math.sign(dx) * foot, player.y)) player.x = nx;
  if (dy !== 0 && passable(player.x, ny + Math.sign(dy) * foot)) player.y = ny;

  // Wide clamp — allows far ocean exploration while preventing numeric overflow
  player.x = Math.max(-80, Math.min(WORLD_W + 80, player.x));
  player.y = Math.max(-80, Math.min(WORLD_H + 80, player.y));
  // Update direction attack vector
  if (dx !== 0 || dy !== 0) { attackDirX = dx; attackDirY = dy; }
  // Reveal fog
  if (fogGrid.length) revealFog(player.x, player.y);

  // Walk animation
  if (player.moving) {
    player.frameTimer += dt;
    if (player.frameTimer > 160) {
      player.frame = (player.frame + 1) % 4;
      player.frameTimer = 0;
    }
  } else {
    player.frame = 0;
  }
}

// ── Fog of war ────────────────────────────────────────────────────────────────

function initFog(): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < WORLD_H; y++) grid.push(new Array(WORLD_W).fill(false));
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const fy = CAMP_Y + dy, fx = CAMP_X + dx;
    if (fy >= 0 && fy < WORLD_H && fx >= 0 && fx < WORLD_W) grid[fy][fx] = true;
  }
  return grid;
}

function revealFog(px: number, py: number): void {
  const r = FOG_REVEAL_RADIUS;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const fy = Math.floor(py) + dy, fx = Math.floor(px) + dx;
    if (fy >= 0 && fy < WORLD_H && fx >= 0 && fx < WORLD_W) fogGrid[fy][fx] = true;
  }
}

function drawFog() {
  const startX = Math.floor(player.x - canvas.width  / 2 / TILE_PX) - 1;
  const startY = Math.floor(player.y - canvas.height / 2 / TILE_PX) - 1;
  const endX   = startX + Math.ceil(canvas.width  / TILE_PX) + 3;
  const endY   = startY + Math.ceil(canvas.height / TILE_PX) + 3;
  for (let ty = startY; ty <= endY; ty++) {
    for (let tx = startX; tx <= endX; tx++) {
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
      if (fogGrid[ty]?.[tx]) continue;
      const { sx, sy } = worldToScreen(tx, ty);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
    }
  }
}

// ── Combat ────────────────────────────────────────────────────────────────────

function playerAttack(): void {
  if (attackCooldown > 0) return;
  const swordBonus = save.equippedItem === 'sword' ? 25 : 0;
  const smithBonus = (save.flags['ren_skill'] as boolean) ? 25 : 0;
  const rangerBonus = save.buildings.some(b => b.kind === 'ranger_station' &&
    Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 6) ? 10 : 0;
  const dmg = 25 + swordBonus + smithBonus + rangerBonus;
  attackCooldown = 30;
  attackFlash    = 10;
  attackDirX = player.dir === 'left' ? -1 : player.dir === 'right' ? 1 : 0;
  attackDirY = player.dir === 'up'   ? -1 : player.dir === 'down'  ? 1 : 0;

  for (const e of [...entities, ...raiders]) {
    if (!e.alive) continue;
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dot  = dx * attackDirX + dy * attackDirY;
    if (dist < 1.5 && (dist < 0.8 || dot > 0)) {
      if (e.hp === undefined) e.hp = 40;
      e.hp -= dmg;
      if (e.hp <= 0) {
        e.alive = false;
        if (raiders.includes(e)) { save.resources.coin += 2; save.resources.wood += 1; }
        else setTimeout(() => { e.alive = true; e.hp = 40; e.x = 8; e.y = 18; e.state = 'idle'; }, 30000);
      }
    }
  }
  // Also damage nearby threat camps
  for (const tc of (save.threatCamps ?? [])) {
    const dx = tc.tx - player.x, dy = tc.ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2.5) {
      tc.hp = Math.max(0, tc.hp - dmg);
      if (tc.hp <= 0) {
        const def = THREATS.find(t => t.id === tc.threatId);
        if (def) {
          educationPopup = { lines: def.defeatText, timer: 500 };
          // Drop loot
          save.resources.wood  += 30; save.resources.stone += 15; save.resources.coin += 10;
          save.carbonCredits = (save.carbonCredits ?? 0) + 20;
          eraBannerText  = `✦  ${def.name} DEFEATED  ✦`; eraBannerTimer = 240;
        }
        // Also clear old enemyCampHp
        save.enemyCampHp = 0;
      }
    }
  }
  if (audioCtx) {
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 200;
    osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(g); g.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.15);
  }
}

function drawAttackArc(): void {
  if (attackFlash <= 0) return;
  const { sx, sy } = worldToScreen(player.x, player.y);
  const angle = Math.atan2(attackDirY, attackDirX);
  ctx.globalAlpha = attackFlash / 10;
  ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 3 * SCALE;
  ctx.beginPath(); ctx.arc(sx, sy, TILE_PX * 1.4, angle - 0.7, angle + 0.7); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── Threat camps ─────────────────────────────────────────────────────────────

function drawEnemyCamp(): void {
  for (const tc of (save.threatCamps ?? [])) {
    if (tc.hp <= 0) continue;
    const def = THREATS.find(t => t.id === tc.threatId);
    const { sx, sy } = worldToScreen(tc.tx, tc.ty);
    const cx = sx + TILE_PX / 2, cy = sy + TILE_PX / 2, s = SCALE;

    ctx.fillStyle = '#1e1418';
    ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def?.campTint ?? '#4a2828'; ctx.lineWidth = s;
    ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2); ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      ctx.fillStyle = def?.campTint ?? '#d8c8a8';
      ctx.fillRect(cx + Math.cos(angle) * 8 * s - s, cy + Math.sin(angle) * 8 * s - 5 * s, 2 * s, 10 * s);
    }
    const flicker = Math.sin(wavePhase * 6) * 0.5 + 0.5;
    ctx.fillStyle = `rgb(${160 + Math.floor(flicker * 40)},${40 + Math.floor(flicker * 20)},10)`;
    ctx.beginPath(); ctx.ellipse(cx, cy, 2 * s, 3 * s + flicker * s, 0, 0, Math.PI * 2); ctx.fill();

    if (fogGrid[tc.ty]?.[tc.tx]) {
      const barW = 30 * s;
      ctx.fillStyle = '#400'; ctx.fillRect(cx - barW / 2, cy - 14 * s, barW, 3 * s);
      ctx.fillStyle = '#c83030'; ctx.fillRect(cx - barW / 2, cy - 14 * s, barW * (tc.hp / tc.maxHp), 3 * s);
      ctx.fillStyle = '#d8c8a8'; ctx.font = '8px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${def?.icon ?? '⚠'} ${def?.name ?? 'Enemy Camp'}`, cx, cy - 16 * s);
      ctx.textAlign = 'left';
    }
  }
  // Backward compat: also draw old camp if no threat camps list (migrated away)
  if (!(save.threatCamps?.length) && (save.enemyCampHp ?? 0) > 0) {
    const { sx, sy } = worldToScreen(CAMP_X, CAMP_Y);
    const cx = sx + TILE_PX / 2, cy = sy + TILE_PX / 2, s = SCALE;
    ctx.fillStyle = '#1e1418'; ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c8a0'; ctx.font = '8px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText('Enemy Camp', cx, cy); ctx.textAlign = 'left';
  }
}

function spawnRaid(): void {
  const count = Math.min((save.raidLevel ?? 1) + 1, 6);
  for (let i = 0; i < count; i++) {
    raiders.push({
      id: `raider_${Date.now()}_${i}`, kind: 'wolf',
      x: CAMP_X + (Math.random() - 0.5) * 3, y: CAMP_Y + (Math.random() - 0.5) * 3,
      vx: 0, vy: 0, phase: i * 0.8, state: 'hunt', stateTimer: 0, alive: true, hp: 40, maxHp: 40,
    });
  }
  raidWarning = 240;
}

function updateRaiders(dt: number): void {
  const spd = dt / 16.67;
  const isNight = dayTime < 420 || dayTime >= 1020;
  if (!isNight) {
    for (const r of raiders) {
      const dx = CAMP_X - r.x, dy = CAMP_Y - r.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      r.x += (dx / d) * 0.06 * spd; r.y += (dy / d) * 0.06 * spd;
      if (d < 1) r.alive = false;
    }
    raiders = raiders.filter(r => r.alive);
    return;
  }

  for (const r of raiders) {
    if (!r.alive) continue;
    let tx = player.x, ty = player.y;
    let bestD = Math.sqrt((player.x - r.x) ** 2 + (player.y - r.y) ** 2);
    for (const b of save.buildings) {
      const d = Math.sqrt((b.tx - r.x) ** 2 + (b.ty - r.y) ** 2);
      if (d < bestD) { bestD = d; tx = b.tx; ty = b.ty; }
    }
    const dx = tx - r.x, dy = ty - r.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    r.x += (dx / d) * 0.038 * spd; r.y += (dy / d) * 0.038 * spd;

    const pdx = player.x - r.x, pdy = player.y - r.y;
    if (Math.sqrt(pdx * pdx + pdy * pdy) < 1.0 && waterVeilTimer <= 0 && windStepTimer <= 0) {
      save.hp = Math.max(0, (save.hp ?? 100) - 0.3 * spd);
      essenceFlash = 8;
      if (save.hp <= 0 && !isDead) { isDead = true; }
    }
    for (const b of save.buildings) {
      const bdx = b.tx - r.x, bdy = b.ty - r.y;
      if (Math.sqrt(bdx * bdx + bdy * bdy) < 1.2) b.hp = Math.max(0, b.hp - 0.08 * spd);
    }
  }
  raiders = raiders.filter(r => r.alive);
  save.buildings = save.buildings.filter(b => b.hp > 0);
}

// ── Threat spawning ───────────────────────────────────────────────────────────

const THREAT_SPAWN_POSITIONS: Partial<Record<string, { tx: number; ty: number }[]>> = {
  industrial_logging:     [{ tx: 5,  ty: 8  }],
  trophy_hunting:         [{ tx: 36, ty: 10 }, { tx: 40, ty: 14 }],
  elephant_poaching:      [{ tx: 28, ty: 6  }, { tx: 32, ty: 8  }],
  exotic_pet_trade:       [{ tx: 14, ty: 5  }, { tx: 20, ty: 4  }],
  ocean_plastic:          [{ tx: 22, ty: 30 }, { tx: 30, ty: 31 }],
  passenger_pigeon_moment:[{ tx: 10, ty: 14 }, { tx: 16, ty: 11 }],
  palm_oil_clearing:      [{ tx: 38, ty: 20 }, { tx: 42, ty: 17 }],
  whaling_operation:      [{ tx: 18, ty: 30 }, { tx: 26, ty: 32 }],
  shark_finning:          [{ tx: 8,  ty: 31 }, { tx: 12, ty: 33 }],
  rhino_poaching:         [{ tx: 34, ty: 26 }, { tx: 38, ty: 30 }],
  pesticide_agriculture:  [{ tx: 28, ty: 22 }, { tx: 24, ty: 26 }],
  deep_sea_trawling:      [{ tx: 6,  ty: 31 }, { tx: 10, ty: 34 }],
  habitat_fragmentation:  [{ tx: 20, ty: 18 }, { tx: 24, ty: 22 }],
};

function maybeSpawnThreats(): void {
  const day = save.dayCount ?? 0;
  const era = save.era;
  const existing = new Set((save.threatCamps ?? []).map(tc => tc.threatId));
  for (const threat of THREATS) {
    if (existing.has(threat.id)) continue;
    if (threat.minEra > era) continue;
    const minDay = threat.minEra === 1 ? 3 : 8;
    if (day < minDay) continue;
    const positions = THREAT_SPAWN_POSITIONS[threat.id];
    if (!positions || positions.length === 0) continue;
    const pos = positions[Math.floor(Math.random() * positions.length)];
    if (!passable(pos.tx, pos.ty)) continue;
    const occupied = (save.threatCamps ?? []).some(tc =>
      Math.sqrt((tc.tx - pos.tx) ** 2 + (tc.ty - pos.ty) ** 2) < 3);
    if (occupied) continue;
    if (Math.random() > 0.2) continue;
    if (!save.threatCamps) save.threatCamps = [];
    save.threatCamps.push({
      id: `camp_${threat.id}_${day}`,
      threatId: threat.id,
      tx: pos.tx, ty: pos.ty,
      hp: threat.hp, maxHp: threat.hp,
      educationShown: false,
    });
    eraBannerText  = `⚠  ${threat.name} spotted  ⚠`;
    eraBannerTimer = 200;
    return; // one spawn per day at most
  }
}

// ── Survival (hunger + sanity + seasons) ─────────────────────────────────────

function updateSurvival(dt: number): void {
  const secs = dt / 1000;
  save.hunger = Math.max(0, (save.hunger ?? 100) - (player.moving ? 0.6 : 0.25) * secs);
  if ((save.hunger ?? 100) < 10) save.hp = Math.max(0, (save.hp ?? 100) - 1 * secs);
  if ((save.hp ?? 100) <= 0 && !isDead) isDead = true;

  const isNight = dayTime < 420 || dayTime >= 1020;
  const nearWolf = entities.some(e => e.kind === 'wolf' && e.alive && Math.sqrt((player.x - e.x) ** 2 + (player.y - e.y) ** 2) < 5);
  const nearFire = save.buildings.some(b => (b.kind === 'signal_fire' || b.kind === 'shelter') && Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 4);
  let sd = 0;
  if (isNight && nearWolf) sd -= 4 * secs;
  if (nearFire) sd += 3 * secs;
  if (spiritMode) sd += secs;
  save.sanity = Math.max(0, Math.min(PLAYER_MAX_SANITY, (save.sanity ?? 100) + sd));

  save.seasonTimer = (save.seasonTimer ?? 120) - secs;
  if (save.seasonTimer <= 0) {
    const idx = SEASON_ORDER.indexOf((save.season ?? 'summer') as Season);
    save.season = SEASON_ORDER[(idx + 1) % 4] as any;
    save.seasonTimer = 120;
    eraBannerText = `✦  ${(save.season as string).toUpperCase()}  ✦`;
    eraBannerTimer = 180;
  }

  const day = Math.floor(save.playTime / 120);
  if (day > lastDayCount) {
    lastDayCount = day;
    save.dayCount = (save.dayCount ?? 0) + 1;
    if (save.dayCount % 3 === 0 && (save.enemyCampHp ?? 400) > 0 && (save.raidLevel ?? 1) < 6)
      save.raidLevel = (save.raidLevel ?? 1) + 1;
    if (Math.random() < 0.4) {
      const eligible = RANDOM_EVENTS.filter(e => e.minDay <= (save.dayCount ?? 0) && !save.flags[`evt_${e.id}`]);
      if (eligible.length) {
        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        pendingEvent = pick; eventBannerTimer = 0; save.flags[`evt_${pick.id}`] = true;
        const [action, ...rest] = pick.effect.split('_');
        const val = parseInt(rest[rest.length - 1], 10) || 0;
        const tgt = rest.slice(0, -1).join('_');
        if (action === 'bonus') (save.resources as any)[tgt] = ((save.resources as any)[tgt] ?? 0) + val;
        else if (action === 'steal') (save.resources as any)[tgt] = Math.max(0, ((save.resources as any)[tgt] ?? 0) - val);
        else if (action === 'raid') save.raidLevel = Math.min(6, (save.raidLevel ?? 1) + 1);
        else if (action === 'sanity') save.sanity = PLAYER_MAX_SANITY;
        else if (action === 'dmg') { const ws = save.buildings.find(b => b.kind === 'workshop'); if (ws) ws.hp = Math.max(1, ws.hp - val); }
      }
    }
    for (const npc of NPC_DEFS) {
      if (!npcsActive.includes(npc.id) && npc.spawnEra <= save.era) npcsActive.push(npc.id);
    }
    // Spawn raid at first night of new day
    if ((save.enemyCampHp ?? 400) > 0) spawnRaid();
    // Maybe spawn a new threat camp based on era + day progression
    maybeSpawnThreats();
  }
}

// ── Unit rendering ────────────────────────────────────────────────────────────

function drawUnits(): void {
  for (const u of units) {
    if (!u.alive) continue;
    const { sx, sy } = worldToScreen(u.x - 0.5, u.y - 1);
    const cx = sx + TILE_PX / 2, cy = sy + TILE_PX / 2 + 2 * SCALE, s = SCALE;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 9 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (u.kind === 'villager') {
      ctx.fillStyle = '#7a5c30'; ctx.beginPath(); ctx.ellipse(cx, cy + 2 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c89060'; ctx.beginPath(); ctx.arc(cx, cy - 5 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      if (u.carryKind) { ctx.fillStyle = resourceColor(u.carryKind); ctx.beginPath(); ctx.arc(cx + 4 * s, cy - 3 * s, 2 * s, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#485870'; ctx.beginPath(); ctx.ellipse(cx, cy + 2 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6878a0'; ctx.beginPath(); ctx.arc(cx, cy - 4 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c0c8e0'; ctx.lineWidth = s;
      ctx.beginPath(); ctx.moveTo(cx + 5 * s, cy - 2 * s); ctx.lineTo(cx + 9 * s, cy + 5 * s); ctx.stroke();
    }
    const bw = 10 * s;
    ctx.fillStyle = '#400'; ctx.fillRect(cx - bw / 2, cy - 13 * s, bw, 2 * s);
    ctx.fillStyle = u.hp > u.maxHp * 0.5 ? '#0c8' : '#f80';
    ctx.fillRect(cx - bw / 2, cy - 13 * s, bw * (u.hp / u.maxHp), 2 * s);
    if (u.selected) { ctx.strokeStyle = '#80ff80'; ctx.lineWidth = s; ctx.beginPath(); ctx.ellipse(cx, cy + 8 * s, 6 * s, 2 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const tq of trainQueue) {
    const bld = save.buildings.find(b => Math.abs(b.tx - tq.spawnX) < 2);
    if (!bld) continue;
    const { sx, sy } = worldToScreen(bld.tx, bld.ty);
    const maxTime = tq.kind === 'villager' ? 20 : 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx, sy - 8, TILE_PX, 6);
    ctx.fillStyle = '#40c840'; ctx.fillRect(sx, sy - 8, TILE_PX * (1 - tq.timeLeft / maxTime), 6);
  }
}

// ── Survival HUD ──────────────────────────────────────────────────────────────

function drawSurvivalHUD(): void {
  const BAR_W = 80, BAR_H = 6, GAP = 4, bx = 14, by2 = canvas.height - 80;
  const hp = save.hp ?? PLAYER_MAX_HP;
  const hunger = save.hunger ?? PLAYER_MAX_HUNGER;
  const sanity = save.sanity ?? PLAYER_MAX_SANITY;

  const bars: Array<[number, string, string]> = [
    [hp / PLAYER_MAX_HP,     hp > 60 ? '#c84040' : '#ff4020', `HP ${Math.ceil(hp)}`],
    [hunger / PLAYER_MAX_HUNGER, hunger > 50 ? '#c8a040' : '#e07020', `Hunger ${Math.ceil(hunger)}`],
    [sanity / PLAYER_MAX_SANITY, sanity > 50 ? '#6080c8' : '#8040a8', `Mind ${Math.ceil(sanity)}`],
  ];
  bars.forEach(([pct, col, label], i) => {
    const by3 = by2 + i * (BAR_H + GAP);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 2, by3 - 2, BAR_W + 4, BAR_H + 4);
    ctx.fillStyle = col; ctx.fillRect(bx, by3, BAR_W * pct, BAR_H);
    ctx.fillStyle = '#c0a080'; ctx.font = '8px "Courier New", monospace';
    ctx.fillText(label, bx + BAR_W + 6, by3 + 6);
  });
}

// ── Sanity shadows ────────────────────────────────────────────────────────────

function drawSanityEffects(): void {
  const sanity = save.sanity ?? PLAYER_MAX_SANITY;
  if (sanity > 30) return;
  const intensity = (30 - sanity) / 30;
  for (const sh of SHADOWS) {
    const sx2 = (sh.x + Math.sin(wavePhase * 0.6 + sh.phase) * 0.15) * canvas.width;
    const sy2 = (sh.y + Math.cos(wavePhase * 0.5 + sh.phase * 1.2) * 0.12) * canvas.height * 0.85;
    const flicker = Math.sin(wavePhase * 2 + sh.phase) * 0.5 + 0.5;
    ctx.globalAlpha = intensity * flicker * 0.5;
    ctx.fillStyle = '#1a0030';
    ctx.beginPath(); ctx.ellipse(sx2, sy2, 18 * SCALE, 28 * SCALE, Math.sin(sh.phase) * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff0060'; ctx.globalAlpha = intensity * flicker * 0.8;
    ctx.fillRect(sx2 - 4 * SCALE, sy2 - 6 * SCALE, 2 * SCALE, 2 * SCALE);
    ctx.fillRect(sx2 + 2 * SCALE, sy2 - 6 * SCALE, 2 * SCALE, 2 * SCALE);
    ctx.globalAlpha = 1;
  }
}

// ── Season tint ───────────────────────────────────────────────────────────────

function drawSeasonTint(): void {
  const tints: Record<string, string> = {
    spring: 'rgba(160,230,100,0.04)', summer: 'rgba(255,200,50,0.03)',
    autumn: 'rgba(200,100,30,0.06)', winter: 'rgba(160,200,255,0.10)',
  };
  const t = tints[(save.season as string) ?? 'summer'];
  if (t) { ctx.fillStyle = t; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (save.season === 'winter') {
    ctx.fillStyle = 'rgba(220,235,255,0.7)';
    for (let i = 0; i < 30; i++) {
      const sx2 = ((Math.sin(i * 1.37) * 0.5 + 0.5 + wavePhase * 0.01 * (0.5 + (i % 3) * 0.3)) % 1) * canvas.width;
      const sy2 = ((Math.cos(i * 0.91) * 0.5 + 0.5 + wavePhase * 0.008 * (0.3 + (i % 4) * 0.2)) % 1) * canvas.height;
      ctx.beginPath(); ctx.arc(sx2, sy2, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ── Minimap ───────────────────────────────────────────────────────────────────

function drawMinimap(): void {
  if (!world) return;
  const MW = 120, MH = 90;
  const MX = canvas.width - MW - 14, MY = canvas.height - MH - 70;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(MX - 2, MY - 2, MW + 4, MH + 4);
  ctx.strokeStyle = '#4a3828'; ctx.lineWidth = 1; ctx.strokeRect(MX - 2, MY - 2, MW + 4, MH + 4);
  const sx2 = MW / WORLD_W, sy2 = MH / WORLD_H;
  for (let ty = 0; ty < WORLD_H; ty++) for (let tx = 0; tx < WORLD_W; tx++) {
    if (!fogGrid[ty]?.[tx]) { ctx.fillStyle = '#111'; ctx.fillRect(MX + tx * sx2, MY + ty * sy2, sx2, sy2); continue; }
    const t = world[ty][tx];
    const cols: Partial<Record<T, string>> = {
      [T.DEEP_WATER]: '#0c1f38', [T.WATER]: '#1a3d6b', [T.SHALLOW]: '#2d6b8a',
      [T.SAND]: '#c8975a', [T.GRASS_LIGHT]: '#4a8535', [T.GRASS]: '#2e6120',
      [T.FOREST_EDGE]: '#1f4a14', [T.FOREST]: '#122b0a', [T.PATH]: '#8b7355',
      [T.RUIN_WALL]: '#3c3028', [T.RUIN_FLOOR]: '#6b5a48', [T.CAVE_WALL]: '#18181e', [T.CAVE_FLOOR]: '#2e2e38',
    };
    ctx.fillStyle = cols[t] ?? '#2e6120'; ctx.fillRect(MX + tx * sx2, MY + ty * sy2, sx2, sy2);
  }
  ctx.fillStyle = '#c8a020';
  for (const b of save.buildings) ctx.fillRect(MX + b.tx * sx2 - 1, MY + b.ty * sy2 - 1, 3, 3);
  if ((save.enemyCampHp ?? 400) > 0) { ctx.fillStyle = '#c82020'; ctx.fillRect(MX + CAMP_X * sx2 - 2, MY + CAMP_Y * sy2 - 2, 4, 4); }
  ctx.fillStyle = '#40c840';
  for (const u of units) { if (!u.alive) continue; ctx.fillRect(MX + u.x * sx2 - 1, MY + u.y * sy2 - 1, 2, 2); }
  ctx.fillStyle = '#ff8020';
  for (const r of raiders) { if (!r.alive) continue; ctx.fillRect(MX + r.x * sx2 - 1, MY + r.y * sy2 - 1, 2, 2); }
  ctx.fillStyle = '#fff'; ctx.fillRect(MX + player.x * sx2 - 2, MY + player.y * sy2 - 2, 4, 4);
  ctx.fillStyle = '#6a5828'; ctx.font = '8px "Courier New", monospace'; ctx.textAlign = 'center';
  ctx.fillText('MAP', MX + MW / 2, MY + MH + 10); ctx.textAlign = 'left';
}

// ── Tech panel ────────────────────────────────────────────────────────────────

function drawTechPanel(): void {
  if (!techPanelOpen) return;
  const W = 320, PAD = 16, H = TECH_DEFS.length * 66 + 56;
  const X = (canvas.width - W) / 2, Y = (canvas.height - H) / 2;
  ctx.fillStyle = 'rgba(6,4,1,0.96)'; ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#6a5020'; ctx.lineWidth = 2; ctx.strokeRect(X, Y, W, H);
  ctx.fillStyle = '#d4a853'; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center'; ctx.fillText('WORKSHOP — TECH RESEARCH', X + W / 2, Y + PAD + 12); ctx.textAlign = 'left';
  let ry = Y + PAD + 28;
  for (const tech of TECH_DEFS) {
    const done = (save.researched ?? []).includes(tech.id);
    const affordable = !done && canAfford(save.resources, tech.cost);
    ctx.fillStyle = done ? 'rgba(20,40,20,0.8)' : 'rgba(20,18,10,0.8)';
    ctx.fillRect(X + PAD, ry, W - PAD * 2, 56);
    ctx.strokeStyle = done ? '#40a840' : '#6a5020'; ctx.lineWidth = 1; ctx.strokeRect(X + PAD, ry, W - PAD * 2, 56);
    ctx.fillStyle = done ? '#60c860' : '#d4c890'; ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText((done ? '✓ ' : '') + tech.label, X + PAD + 10, ry + 16);
    ctx.fillStyle = '#8a7848'; ctx.font = '9px "Courier New", monospace'; ctx.fillText(tech.desc, X + PAD + 10, ry + 30);
    if (!done) {
      const cs = [tech.cost.wood > 0 ? `${tech.cost.wood}W` : '', tech.cost.stone > 0 ? `${tech.cost.stone}S` : '', tech.cost.food > 0 ? `${tech.cost.food}F` : '', tech.cost.coin > 0 ? `${tech.cost.coin}C` : ''].filter(Boolean).join('·');
      ctx.fillStyle = affordable ? '#c8a020' : '#603828'; ctx.textAlign = 'right';
      ctx.fillText(affordable ? `[E] ${cs}` : cs, X + W - PAD - 8, ry + 22); ctx.textAlign = 'left';
    }
    ry += 64;
  }
  ctx.fillStyle = '#4a3d20'; ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center'; ctx.fillText('[T] or [Esc] close', X + W / 2, Y + H - 12); ctx.textAlign = 'left';
}

// ── Inventory panel ───────────────────────────────────────────────────────────

function drawInventoryPanel(): void {
  if (!inventoryOpen) return;
  const items = craftTarget ? ITEM_DEFS.filter(i => i.craftAt === craftTarget) : ITEM_DEFS;
  const W = 340, PAD = 14, H = items.length * 56 + 72;
  const X = (canvas.width - W) / 2, Y = (canvas.height - H) / 2;
  ctx.fillStyle = 'rgba(4,4,8,0.97)'; ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#304860'; ctx.lineWidth = 2; ctx.strokeRect(X, Y, W, H);
  ctx.fillStyle = '#80aad0'; ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(craftTarget ? `${craftTarget.toUpperCase().replace('_', ' ')} — CRAFT` : 'INVENTORY', X + W / 2, Y + PAD + 12);
  const inv = save.inventory ?? [];
  ctx.fillStyle = '#405870'; ctx.font = '9px "Courier New", monospace';
  ctx.fillText(`Carrying: ${inv.length ? inv.map(i => `${i.kind}×${i.qty}`).join(' ') : 'empty'}`, X + W / 2, Y + PAD + 26);
  ctx.textAlign = 'left';
  let ry = Y + PAD + 36;
  for (const def of items) {
    const owned = inv.find(i => i.kind === def.kind);
    const affordable = canAfford(save.resources, def.cost);
    ctx.fillStyle = 'rgba(16,20,30,0.8)'; ctx.fillRect(X + PAD, ry, W - PAD * 2, 46);
    ctx.strokeStyle = '#304060'; ctx.lineWidth = 1; ctx.strokeRect(X + PAD, ry, W - PAD * 2, 46);
    ctx.fillStyle = '#c0d4f0'; ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(def.label + (owned ? ` (×${owned.qty})` : ''), X + PAD + 10, ry + 16);
    ctx.fillStyle = '#607888'; ctx.font = '9px "Courier New", monospace'; ctx.fillText(def.desc, X + PAD + 10, ry + 29);
    const cs = [def.cost.wood > 0 ? `${def.cost.wood}W` : '', def.cost.stone > 0 ? `${def.cost.stone}S` : '', def.cost.food > 0 ? `${def.cost.food}F` : '', def.cost.coin > 0 ? `${def.cost.coin}C` : ''].filter(Boolean).join('·');
    ctx.fillStyle = affordable ? '#a0c820' : '#603828'; ctx.textAlign = 'right';
    ctx.fillText(affordable ? `[E] ${cs}` : cs, X + W - PAD - 8, ry + 22); ctx.textAlign = 'left';
    ry += 54;
  }
  ctx.fillStyle = '#304050'; ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center'; ctx.fillText('[I] or [Esc] close', X + W / 2, Y + H - 12); ctx.textAlign = 'left';
}

// ── NPC rendering ──────────────────────────────────────────────────────────────

function drawNPCs(): void {
  for (const npcId of npcsActive) {
    const def = NPC_DEFS.find(n => n.id === npcId);
    if (!def) continue;
    const { sx, sy } = worldToScreen(def.tx, def.ty);
    const cx = sx + TILE_PX / 2, cy = sy + TILE_PX / 2, s = SCALE;
    const cols: Record<string, string> = { maya: '#2060a0', ren: '#804020', lena: '#206050' };
    ctx.fillStyle = cols[def.id] ?? '#606060';
    ctx.beginPath(); ctx.ellipse(cx, cy + 2 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c89060'; ctx.beginPath(); ctx.arc(cx, cy - 5 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - 18, cy - 16 * s, 36, 12);
    ctx.fillStyle = '#d4c890'; ctx.font = '8px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText(def.name, cx, cy - 16 * s + 9); ctx.textAlign = 'left';
    const dx = player.x - def.tx, dy = player.y - def.ty;
    if (Math.sqrt(dx * dx + dy * dy) < 2) {
      const prompt = `[ E ] speak with ${def.name}`;
      const pw = prompt.length * 8 + 24, px2 = canvas.width / 2 - pw / 2, py2 = canvas.height - 54;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(px2, py2, pw, 28);
      ctx.strokeStyle = '#6080a0'; ctx.lineWidth = 1; ctx.strokeRect(px2, py2, pw, 28);
      ctx.fillStyle = '#d4c890'; ctx.font = '12px "Courier New", monospace'; ctx.textAlign = 'center';
      ctx.fillText(prompt, canvas.width / 2, py2 + 18); ctx.textAlign = 'left';
    }
  }
}

// ── Raid + event banner ───────────────────────────────────────────────────────

function drawRaidWarning(): void {
  if (raidWarning > 0) {
    raidWarning--;
    ctx.globalAlpha = Math.min(1, raidWarning / 40);
    ctx.fillStyle = 'rgba(100,0,0,0.8)';
    const msg = '⚔  RAIDERS FROM THE NORTHWEST  ⚔';
    const tw = msg.length * 7.5 + 30;
    ctx.fillRect(canvas.width / 2 - tw / 2, 60, tw, 28);
    ctx.fillStyle = '#ff6060'; ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.fillText(msg, canvas.width / 2, 79); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  if (pendingEvent && eventBannerTimer < 300) {
    eventBannerTimer++;
    const alpha = Math.min(1, eventBannerTimer / 40) * Math.min(1, (300 - eventBannerTimer) / 40);
    const col = pendingEvent.tone === 'good' ? '#60c880' : pendingEvent.tone === 'bad' ? '#ff8040' : '#c8c060';
    ctx.globalAlpha = Math.max(0, alpha);
    const msg = `${pendingEvent.title}: ${pendingEvent.desc}`;
    const t2 = msg.length > 70 ? msg.slice(0, 67) + '…' : msg;
    const tw = t2.length * 6.5 + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(canvas.width / 2 - tw / 2, 96, tw, 26);
    ctx.fillStyle = col; ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText(t2, canvas.width / 2, 113); ctx.globalAlpha = 1; ctx.textAlign = 'left';
    if (eventBannerTimer >= 300) pendingEvent = null;
  }
}

// ── Death overlay ─────────────────────────────────────────────────────────────

function drawDeath(): void {
  if (!isDead) return;
  deathFade = Math.min(1, deathFade + 0.02);
  ctx.fillStyle = `rgba(0,0,0,${deathFade})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (deathFade >= 1) {
    ctx.fillStyle = '#c03030'; ctx.font = 'bold 20px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText('You fell.', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#806060'; ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Lost 20% resources.', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText('[ R ] Respawn at shelter', canvas.width / 2, canvas.height / 2 + 36);
    ctx.textAlign = 'left';
    if (keys['r'] || keys['R']) {
      save.hp = PLAYER_MAX_HP * 0.5; save.hunger = 60; save.essence = 60;
      save.resources.wood  = Math.floor(save.resources.wood  * 0.8);
      save.resources.stone = Math.floor(save.resources.stone * 0.8);
      save.resources.food  = Math.floor(save.resources.food  * 0.8);
      save.resources.coin  = Math.floor(save.resources.coin  * 0.8);
      player.x = save.respawnX ?? 24; player.y = save.respawnY ?? 30;
      isDead = false; deathFade = 0;
    }
  }
}

// ── NPC interaction ───────────────────────────────────────────────────────────

function handleNpcInteract(npcId: string): void {
  const def = NPC_DEFS.find(n => n.id === npcId);
  if (!def) return;
  const done = save.flags[`npc_quest_done_${npcId}`] as boolean | undefined;
  if (!done) {
    if (save.resources[def.questItem] >= def.questAmount) {
      save.resources[def.questItem] -= def.questAmount;
      save.flags[`npc_quest_done_${npcId}`] = true;
      save.flags[`${npcId}_skill`] = true;
      openDialog({ id: `npc_r_${npcId}`, tx: def.tx, ty: def.ty, range: 999, prompt: '',
        lines: [...def.rewardLines, `Skill: ${def.rewardLabel}`] });
    } else {
      openDialog({ id: `npc_q_${npcId}`, tx: def.tx, ty: def.ty, range: 999, prompt: '',
        lines: [...def.questLines, `Need: ${def.questAmount} ${def.questItem}  (have: ${save.resources[def.questItem]})`] });
    }
  } else {
    openDialog({ id: `npc_c_${npcId}`, tx: def.tx, ty: def.ty, range: 999, prompt: '',
      lines: [`${def.name} — skill: ${def.rewardLabel}`] });
  }
}

// ── Forest restoration system ────────────────────────────────────────────────

function tileKey(tx: number, ty: number): string { return `${tx},${ty}`; }

function calcBiodiversityIndex(): number {
  const tiles = save.plantedTiles ?? {};
  if (Object.keys(tiles).length === 0) return 0;
  const speciesPresent = new Set<string>();
  let total = 0, keystoneBonus = 1;
  for (const pt of Object.values(tiles)) {
    if (pt.maturity < 0.5) continue;
    const def = getSpecies(pt.speciesId);
    if (!def) continue;
    speciesPresent.add(pt.speciesId);
    total += def.biodiversityScore * pt.maturity * pt.health;
    if (def.keystoneMultiplier > 1) keystoneBonus = Math.max(keystoneBonus, def.keystoneMultiplier);
  }
  const mycoLab = save.buildings.some(b => b.kind === 'myco_lab');
  const connectivity = mycoLab ? 1.5 : 1.0;
  const raw = (speciesPresent.size * 5 + total) * keystoneBonus * connectivity;
  return Math.min(100, Math.round(raw));
}

function updateForest(dt: number): void {
  const secs = dt / 1000;
  const tiles = save.plantedTiles ?? {};
  const season = (save.season ?? 'summer') as string;
  const seedBank = save.buildings.some(b => b.kind === 'seed_bank');
  const nursery  = save.buildings.some(b => b.kind === 'tree_nursery');
  const mycoLab  = save.buildings.some(b => b.kind === 'myco_lab');

  for (const [key, pt] of Object.entries(tiles)) {
    const def = getSpecies(pt.speciesId);
    if (!def) { delete tiles[key]; continue; }

    // Growth speed modifiers
    let growthMult = 1;
    if (season === 'spring') growthMult = 2;
    if (season === 'winter' && def.biomes.some(b => b === 'tropical')) {
      growthMult = seedBank ? 0.1 : 0;  // tropical species die in winter unless seed bank
    }
    if (nursery) growthMult *= 1.5;
    // Nitrogen-fixer adjacency bonus
    const [stx, sty] = key.split(',').map(Number);
    let nitroBonus = 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const nb = tiles[tileKey(stx + dx, sty + dy)];
        if (!nb) continue;
        const nbDef = getSpecies(nb.speciesId);
        if (nbDef?.ecologicalRoles.includes('nitrogen_fixer')) { nitroBonus = 1.5; break; }
      }
    }

    const seasonsPassed = (save.dayCount ?? 0) / 4; // 4 days per season approx
    const targetMaturity = Math.min(1, seasonsPassed / (def.growthSeasons * 4));
    const growRate = (targetMaturity - pt.maturity) * growthMult * nitroBonus * secs * 0.05;
    pt.maturity = Math.min(1, pt.maturity + Math.max(0, growRate));

    // Health
    let health = pt.health;
    const anyThreat = (save.threatCamps ?? []).some(tc => {
      const d = Math.sqrt((tc.tx - stx) ** 2 + (tc.ty - sty) ** 2);
      return d < 5 && tc.hp > 0;
    });
    if (anyThreat) health = Math.max(0.2, health - 0.01 * secs);
    else health = Math.min(1, health + 0.005 * secs);
    if (mycoLab) health = Math.min(1, health + 0.003 * secs); // network healing
    pt.health = health;

    // Spread: mature species spread to adjacent empty tiles occasionally
    if (pt.maturity >= 1 && Math.random() < 0.0001 * secs * def.spreadRadius) {
      const spreadMult = mycoLab ? 2 : 1;
      for (let attempt = 0; attempt < spreadMult; attempt++) {
        const sx2 = stx + Math.round((Math.random() - 0.5) * def.spreadRadius * 2);
        const sy2 = sty + Math.round((Math.random() - 0.5) * def.spreadRadius * 2);
        const nk = tileKey(sx2, sy2);
        if (!tiles[nk] && passable(sx2, sy2)) {
          // Only pioneers can spread to bare tiles; others need existing forest
          const hasForesNeighbour = Object.keys(tiles).some(k => {
            const [nx, ny] = k.split(',').map(Number);
            return Math.sqrt((nx - sx2) ** 2 + (ny - sy2) ** 2) < 2;
          });
          if (def.ecologicalRoles.includes('pioneer') || hasForesNeighbour) {
            tiles[nk] = { speciesId: def.id, plantedDay: save.dayCount ?? 0, maturity: 0.05, health: 0.8 };
            save.carbonCredits = (save.carbonCredits ?? 0) + 1;
          }
        }
      }
    }
  }

  // Update biodiversity index
  biodiversityIndex = calcBiodiversityIndex();

  // ── GLV zone simulation (once per game day) ──────────────────────────────
  const currentDay = save.dayCount ?? 0;
  if (currentDay !== lastGlvDay) {
    lastGlvDay = currentDay;

    // Group planted tiles by zone
    const zoneSpecies = new Map<string, Set<string>>();
    for (const key of Object.keys(save.plantedTiles ?? {})) {
      const [tx, ty] = key.split(',').map(Number);
      const zid = `${Math.floor(tx / ZONE_SIZE)},${Math.floor(ty / ZONE_SIZE)}`;
      if (!zoneSpecies.has(zid)) zoneSpecies.set(zid, new Set());
      zoneSpecies.get(zid)!.add((save.plantedTiles ?? {})[key].speciesId);
    }

    // Tick or create each active zone
    for (const [zid, sids] of zoneSpecies) {
      const sidArr = [...sids];
      const existing = forestZones.get(zid);
      if (!existing || existing.speciesIds.join(',') !== sidArr.sort().join(',')) {
        // Rebuild zone if species composition changed
        forestZones.set(zid, makeZone(zid, sidArr, SPECIES));
      } else {
        forestZones.set(zid, tickZone(existing));
      }
    }
    // Remove zones that no longer have any plants
    for (const zid of forestZones.keys()) {
      if (!zoneSpecies.has(zid)) forestZones.delete(zid);
    }

    // Trophic cascade: detect new thriving zones and notify with fauna arrivals
    for (const [zid, zone] of forestZones) {
      const prev = prevZoneStability.get(zid);
      if (zone.stability === 'thriving' && prev !== 'thriving') {
        const keystones = [...(zoneSpecies.get(zid) ?? [])].filter(sid =>
          getSpecies(sid)?.ecologicalRoles.includes('keystone'));
        const fauna = keystones.flatMap(sid => getSpecies(sid)?.supports.slice(0, 2) ?? []);
        if (fauna.length > 0) {
          educationPopup = {
            lines: [
              `✦ TROPHIC CASCADE — Zone restored to THRIVING`,
              `Keystone species stabilised the ecosystem.`,
              `Fauna returning to the area:`,
              ...fauna.slice(0, 4).map(f => `  · ${f}`),
            ],
            timer: 500,
          };
        }
      }
      prevZoneStability.set(zid, zone.stability);
    }

    // Passive resource income: thriving zones provide food + wood per day
    let thrivingCount = 0;
    for (const z of forestZones.values()) {
      if (z.stability === 'thriving') thrivingCount++;
    }
    if (thrivingCount > 0) {
      save.resources.food = (save.resources.food ?? 0) + thrivingCount * 2;
      save.resources.wood = (save.resources.wood ?? 0) + thrivingCount;
    }

    // Feed zone health back to individual tile health
    for (const [key, pt] of Object.entries(save.plantedTiles ?? {})) {
      const [tx, ty] = key.split(',').map(Number);
      const zid = `${Math.floor(tx / ZONE_SIZE)},${Math.floor(ty / ZONE_SIZE)}`;
      const zone = forestZones.get(zid);
      if (!zone) continue;
      const sidIdx = zone.speciesIds.indexOf(pt.speciesId);
      if (sidIdx >= 0) {
        // Nudge tile health toward zone population for this species
        pt.health = Math.min(1, Math.max(0.05, pt.health * 0.9 + zone.N[sidIdx] * 0.1));
      }
    }
  }

  // Update threat camps
  for (const tc of (save.threatCamps ?? [])) {
    const d = Math.sqrt((player.x - tc.tx) ** 2 + (player.y - tc.ty) ** 2);
    if (d < 4 && !tc.educationShown) {
      tc.educationShown = true;
      const def = THREATS.find(t => t.id === tc.threatId);
      if (def) {
        educationPopup = { lines: def.encounterText, timer: 400 };
      }
    }
  }
}

function plantSpecies(speciesId: string, tx: number, ty: number): boolean {
  const def = getSpecies(speciesId);
  if (!def) return false;
  if (!canAfford(save.resources, def.cost)) return false;
  if ((def.carbonCost ?? 0) > 0 && (save.carbonCredits ?? 0) < def.carbonCost!) return false;
  const key = tileKey(tx, ty);
  if ((save.plantedTiles ?? {})[key]) return false; // already planted

  // Pioneers can go on any passable tile; others need adjacent forest
  const isPioneer = def.ecologicalRoles.includes('pioneer');
  const isAquatic = def.ecologicalRoles.includes('aquatic');
  const tile = tileAt(tx, ty);
  if (!TILE_DEFS[tile]?.passable) return false;
  const hasWaterCatchment = save.buildings.some(b =>
    b.kind === 'water_catchment' && Math.sqrt((tx - b.tx) ** 2 + (ty - b.ty) ** 2) < 6);
  if (isAquatic && tile !== 1 && tile !== 2 && tile !== 13 && !(hasWaterCatchment && tile === T.SAND)) return false;
  if (!isPioneer && !isAquatic) {
    const existingForest = Object.keys(save.plantedTiles ?? {}).some(k => {
      const [nx, ny] = k.split(',').map(Number);
      return Math.sqrt((nx - tx) ** 2 + (ny - ty) ** 2) < 3;
    });
    // Also OK to plant near existing trees (forest edge tiles)
    const nearForestTile = tileAt(tx - 1, ty) === T.FOREST || tileAt(tx + 1, ty) === T.FOREST ||
      tileAt(tx, ty - 1) === T.FOREST || tileAt(tx, ty + 1) === T.FOREST;
    if (!existingForest && !nearForestTile) return false;
  }

  deductCost(save.resources, def.cost);
  if (def.carbonCost) save.carbonCredits = (save.carbonCredits ?? 0) - def.carbonCost;
  if (!save.plantedTiles) save.plantedTiles = {};
  save.plantedTiles[key] = { speciesId, plantedDay: save.dayCount ?? 0, maturity: 0.05, health: 1 };
  save.carbonCredits = (save.carbonCredits ?? 0) + 2;
  eraBannerText = `✦  Planted ${def.commonName}  ✦`;
  eraBannerTimer = 100;
  return true;
}

function drawForestLayer(): void {
  // ── Zone stability overlays ───────────────────────────────────────────────
  const pulse = Math.sin(Date.now() / 700) * 0.5 + 0.5;
  for (const [zid, zone] of forestZones) {
    if (zone.stability === 'empty' || zone.stability === 'growing') continue;
    const [zx, zy] = zid.split(',').map(Number);
    const { sx, sy } = worldToScreen(zx * ZONE_SIZE, zy * ZONE_SIZE);
    const zw = ZONE_SIZE * TILE_PX, zh = ZONE_SIZE * TILE_PX;

    if (zone.stability === 'thriving') {
      ctx.fillStyle = `rgba(40,200,60,${0.04 + pulse * 0.05})`;
      ctx.fillRect(sx, sy, zw, zh);
      // Corner glow dots
      ctx.fillStyle = `rgba(80,255,80,${0.2 + pulse * 0.3})`;
      for (const [cx2, cy2] of [[sx+4,sy+4],[sx+zw-4,sy+4],[sx+4,sy+zh-4],[sx+zw-4,sy+zh-4]] as [number,number][]) {
        ctx.beginPath(); ctx.arc(cx2, cy2, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (zone.stability === 'stressed') {
      ctx.fillStyle = `rgba(200,140,20,${0.04 + pulse * 0.06})`;
      ctx.fillRect(sx, sy, zw, zh);
    } else if (zone.stability === 'collapsed') {
      ctx.fillStyle = 'rgba(60,40,30,0.18)';
      ctx.fillRect(sx, sy, zw, zh);
      // Warning icon centre of zone
      const mx = sx + zw / 2, my = sy + zh / 2;
      ctx.fillStyle = `rgba(200,80,30,${0.4 + pulse * 0.4})`;
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✗', mx, my + 4);
      ctx.textAlign = 'left';
    }
  }

  const tiles = save.plantedTiles ?? {};
  for (const [key, pt] of Object.entries(tiles)) {
    const [tx, ty] = key.split(',').map(Number);
    const def = getSpecies(pt.speciesId);
    if (!def) continue;
    const { sx, sy } = worldToScreen(tx, ty);
    const s = SCALE;
    // Forest floor deepens with maturity — green tint on the tile beneath
    if (pt.maturity > 0.2) {
      ctx.fillStyle = 'rgba(20,70,10,1)';
      ctx.globalAlpha = pt.maturity * 0.28;
      ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
    }
    const alpha = 0.3 + pt.maturity * 0.7;
    const healthTint = pt.health < 0.4 ? 0.4 : 1;
    ctx.globalAlpha = alpha * healthTint;
    // Draw plant sprite based on canopy layer
    const cx = sx + TILE_PX / 2, cy = sy + TILE_PX * 0.7;
    const size = (pt.maturity * 0.6 + 0.4) * s;
    if (def.canopyLayer === 'ground' || def.canopyLayer === 'shrub') {
      // Low plant: small cluster of circles
      ctx.fillStyle = def.spriteTint;
      ctx.beginPath(); ctx.arc(cx, cy, 4 * size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.spriteTint + 'aa';
      ctx.beginPath(); ctx.arc(cx - 3 * size, cy - 2 * size, 2.5 * size, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3 * size, cy - 2 * size, 2.5 * size, 0, Math.PI * 2); ctx.fill();
    } else if (def.canopyLayer === 'understory') {
      // Small tree shape
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(cx - s, cy, 2 * s, 5 * size);
      ctx.fillStyle = def.spriteTint;
      ctx.beginPath(); ctx.arc(cx, cy, 5 * size, 0, Math.PI * 2); ctx.fill();
    } else {
      // Full tree (canopy / emergent)
      const h = (def.canopyLayer === 'emergent' ? 12 : 8) * size;
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(cx - 1.5 * s, cy - h * 0.3, 3 * s, h * 0.7);
      ctx.fillStyle = def.spriteTint;
      ctx.beginPath(); ctx.arc(cx, cy - h * 0.4, 6 * size, 0, Math.PI * 2); ctx.fill();
      if (def.canopyLayer === 'emergent') {
        ctx.fillStyle = def.spriteTint + '88';
        ctx.beginPath(); ctx.arc(cx, cy - h * 0.7, 3 * size, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Maturity sparkle: tiny white dots when fully grown
    if (pt.maturity >= 1 && Math.random() < 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(cx + (Math.random() - 0.5) * 8 * s, cy - (Math.random() * 6 * s), s * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawPlantPanel(): void {
  if (!plantMode) return;
  const allSpecies = SPECIES;
  const PAGE = SPECIES_PER_PAGE;
  const pageCount = Math.ceil(allSpecies.length / PAGE);
  speciesPanelPage = Math.max(0, Math.min(pageCount - 1, speciesPanelPage));
  const visible = allSpecies.slice(speciesPanelPage * PAGE, (speciesPanelPage + 1) * PAGE);
  const W = 380, ROW = 52, PAD = 12;
  const H = visible.length * ROW + 88;
  const X = (canvas.width - W) / 2, Y = (canvas.height - H) / 2;

  ctx.fillStyle = 'rgba(2,10,2,0.97)'; ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#204810'; ctx.lineWidth = 2; ctx.strokeRect(X, Y, W, H);

  ctx.fillStyle = '#50c050'; ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('✦  PLANT SPECIES CATALOGUE  ✦', X + W / 2, Y + PAD + 12);
  ctx.fillStyle = '#304820'; ctx.font = '9px "Courier New", monospace';
  ctx.fillText(`Biodiversity Index: ${biodiversityIndex}%  ·  Carbon Credits: ${save.carbonCredits ?? 0}  ·  Page ${speciesPanelPage + 1}/${pageCount}`, X + W / 2, Y + PAD + 27);

  ctx.textAlign = 'left';
  let ry = Y + PAD + 38;
  for (const def of visible) {
    const affordable = canAfford(save.resources, def.cost);
    const selected = selectedSpeciesId === def.id;
    ctx.fillStyle = selected ? 'rgba(20,50,20,0.9)' : 'rgba(8,16,8,0.8)';
    ctx.fillRect(X + PAD, ry, W - PAD * 2, ROW - 4);
    ctx.strokeStyle = selected ? '#40a840' : '#1a3010'; ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(X + PAD, ry, W - PAD * 2, ROW - 4);
    // Tint swatch
    ctx.fillStyle = def.spriteTint;
    ctx.fillRect(X + PAD + 6, ry + 6, 8, ROW - 16);
    // Name + scientific
    ctx.fillStyle = '#b0e890'; ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText(def.commonName, X + PAD + 22, ry + 14);
    ctx.fillStyle = '#507840'; ctx.font = 'italic 8px "Courier New", monospace';
    ctx.fillText(def.scientificName, X + PAD + 22, ry + 25);
    // Family
    ctx.fillStyle = '#406030'; ctx.font = '8px "Courier New", monospace';
    ctx.fillText(`${def.family} · ${def.ecologicalRoles[0].replace('_', ' ')}`, X + PAD + 22, ry + 36);
    // Cost
    const cs = Object.entries(def.cost).filter(([,v]) => v > 0).map(([k, v]) => `${v}${k[0].toUpperCase()}`).join('·');
    const ccCost = def.carbonCost ?? 0;
    const canAffordCC = ccCost === 0 || (save.carbonCredits ?? 0) >= ccCost;
    const ccStr = ccCost > 0 ? ` +${ccCost}✦CC` : '';
    const fullyAffordable = affordable && canAffordCC;
    ctx.fillStyle = fullyAffordable ? '#80c040' : !canAffordCC ? '#a050c0' : '#602820';
    ctx.textAlign = 'right';
    ctx.fillText(fullyAffordable ? `[click] ${cs}${ccStr}` : `${cs}${ccStr}`, X + W - PAD - 6, ry + 24);
    ctx.textAlign = 'left';
    // Biodiversity score stars
    ctx.fillStyle = '#50a020';
    ctx.fillText('★'.repeat(Math.round(def.biodiversityScore / 2)), X + PAD + 22, ry + 47);
    ry += ROW;
  }
  ctx.fillStyle = '#1a3010'; ctx.textAlign = 'center'; ctx.font = '9px "Courier New", monospace';
  ctx.fillText('[←][→] page  ·  [click species] select  ·  [click world] plant  ·  [P] close', X + W / 2, Y + H - 10);
  ctx.textAlign = 'left';
}

function drawBiodiversityHUD(): void {
  const W = 200, H = 14, x = (canvas.width - W) / 2, y = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 2, y - 2, W + 4, H + 22);
  ctx.fillStyle = '#0a1a0a'; ctx.fillRect(x, y, W, H);
  const pct = biodiversityIndex / 100;
  const col = pct < 0.25 ? '#803010' : pct < 0.5 ? '#a07010' : pct < 0.75 ? '#60a030' : '#20e040';
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(W * pct), H);
  ctx.strokeStyle = '#204810'; ctx.lineWidth = 1; ctx.strokeRect(x, y, W, H);
  ctx.fillStyle = '#90d060'; ctx.font = '8px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Biodiversity ${biodiversityIndex}%  ·  CC:${save.carbonCredits ?? 0}`, x + W / 2, y + 10);

  // Zone stability summary
  let thriving = 0, stressed = 0, collapsed = 0;
  for (const z of forestZones.values()) {
    if (z.stability === 'thriving') thriving++;
    else if (z.stability === 'stressed') stressed++;
    else if (z.stability === 'collapsed') collapsed++;
  }
  const zoneParts: string[] = [];
  if (thriving  > 0) zoneParts.push(`${thriving}✦`);
  if (stressed  > 0) zoneParts.push(`${stressed}~`);
  if (collapsed > 0) zoneParts.push(`${collapsed}✗`);
  const zoneStr = zoneParts.length ? zoneParts.join(' ') : 'no zones yet';
  ctx.fillStyle = '#507840';
  ctx.fillText(`zones: ${zoneStr}`, x + W / 2, y + 24);
  ctx.textAlign = 'left';
}

function drawEducationPopup(): void {
  if (!educationPopup) return;
  educationPopup.timer--;
  if (educationPopup.timer <= 0) { educationPopup = null; return; }
  const alpha = Math.min(1, educationPopup.timer / 40) * Math.min(1, (400 - educationPopup.timer) / 20);
  const lines = educationPopup.lines;
  const W = 440, PAD = 18;
  const H = lines.length * 22 + PAD * 2;
  const X = (canvas.width - W) / 2, Y = canvas.height / 2 - H / 2 - 40;
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = 'rgba(2,6,2,0.97)'; ctx.fillRect(X, Y, W, H);
  ctx.strokeStyle = '#308030'; ctx.lineWidth = 2; ctx.strokeRect(X, Y, W, H);
  ctx.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) {
    const isFact = lines[i].startsWith('"FACT:');
    ctx.fillStyle = isFact ? '#a0e070' : '#d0eca0';
    ctx.font = isFact ? 'bold 9px "Courier New", monospace' : 'italic 10px "Courier New", monospace';
    // Word wrap
    let line = lines[i];
    if (line.length > 62) line = line.slice(0, 60) + '…';
    ctx.fillText(line, X + W / 2, Y + PAD + 15 + i * 22);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// ── Resource gathering ────────────────────────────────────────────────────────

function nearbyResourceNode() {
  for (const node of RESOURCE_NODES) {
    const depletedUntil = save.flags[`dep_${node.id}`] as number | undefined;
    if (depletedUntil && depletedUntil > Date.now()) continue;
    const dx = player.x - node.tx, dy = player.y - node.ty;
    if (Math.sqrt(dx * dx + dy * dy) < 1.8) return node;
  }
  return null;
}

function gatherResource(nodeId: string) {
  const node = RESOURCE_NODES.find(n => n.id === nodeId);
  if (!node) return;
  const forgeBonus = save.buildings.some(b => b.kind === 'forge') ? 1.5 : 1;
  const catchmentBonus = node.kind === 'food' && save.buildings.some(b =>
    b.kind === 'water_catchment' && Math.sqrt((node.tx - b.tx) ** 2 + (node.ty - b.ty) ** 2) < 8)
    ? 1.3 : 1;
  const zoneId = `${Math.floor(node.tx / ZONE_SIZE)},${Math.floor(node.ty / ZONE_SIZE)}`;
  const zoneBonus = forestZones.get(zoneId)?.stability === 'thriving' ? 1.15 : 1;
  const amount = Math.round(node.yield * forgeBonus * catchmentBonus * zoneBonus);
  save.resources[node.kind] += amount;
  save.flags[`dep_${node.id}`] = Date.now() + node.respawnSecs * 1000;

  // Floating text
  const { sx, sy } = worldToScreen(node.tx, node.ty);
  gatherFlash = { kind: node.kind, amount, sx, sy, timer: 60 };
}

// ── Building placement ────────────────────────────────────────────────────────

function placeBuilding(kind: BuildingKind, tx: number, ty: number) {
  const def = BUILDING_DEFS.find(d => d.kind === kind);
  if (!def) return;
  if (!canAfford(save.resources, def.cost)) return;
  if (def.unique && save.buildings.some(b => b.kind === kind)) return;
  const tile = tileAt(tx, ty);
  const tileDef = TILE_DEFS[tile];
  if (!tileDef?.passable || tile === 0 || tile === 1 || tile === 2) return;
  if (save.buildings.some(b => b.tx === tx && b.ty === ty)) return;

  deductCost(save.resources, def.cost);
  save.buildings.push({ id: `${kind}_${Date.now()}`, kind, tx, ty, hp: def.maxHp, maxHp: def.maxHp });
  checkEraAdvance();
}

function checkEraAdvance() {
  if (save.era === 1) {
    const hasShelter  = save.buildings.some(b => b.kind === 'shelter');
    const hasWorkshop = save.buildings.some(b => b.kind === 'workshop');
    if (hasShelter && hasWorkshop) {
      save.era = 2;
      eraBannerText  = '✦  ERA II: SETTLED  ✦';
      eraBannerTimer = 240;
    }
  }
  if (save.era === 2) {
    if (save.shipParts.length === SHIP_PARTS.length) {
      save.era = 3;
      eraBannerText  = '✦  ERA III: READY TO SAIL  ✦';
      eraBannerTimer = 240;
    }
  }
}

function craftShipPart(partId: string) {
  const part = SHIP_PARTS.find(p => p.id === partId);
  if (!part) return;
  if (save.shipParts.includes(partId)) return;
  if (!canAfford(save.resources, part.cost)) return;
  deductCost(save.resources, part.cost);
  save.shipParts.push(partId);
  openDialog({
    id: `craft_${partId}`,
    tx: player.x, ty: player.y, range: 999,
    prompt: '',
    lines: [part.flavorText],
  });
  checkEraAdvance();
}

// ── Entity AI ─────────────────────────────────────────────────────────────────

function updateEntities(dt: number) {
  const isNight   = dayTime < 420 || dayTime >= 1020;
  const spd       = dt / 16.67;
  const px = player.x, py = player.y;

  // Fox: lead toward nearest uncollected rune
  const fox = entities.find(e => e.kind === 'fox');
  let foxTargetRune = fox ? RUNES.find(r => !save.collectedRunes.includes(r.kind)) : null;

  for (const e of entities) {
    if (!e.alive) continue;

    // Wolves sleep during day
    if (e.kind === 'wolf' && !isNight) {
      e.state = 'idle'; e.vx = 0; e.vy = 0; continue;
    }

    const dx = px - e.x, dy = py - e.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    e.stateTimer = Math.max(0, e.stateTimer - 1);

    if (e.kind === 'deer') {
      if (distToPlayer < 4) {
        e.state = 'flee';
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        e.vx = -(dx / len) * 0.055 * spd;
        e.vy = -(dy / len) * 0.055 * spd;
      } else if (e.state === 'flee' && distToPlayer > 7) {
        e.state  = 'idle';
        e.stateTimer = 120;
        e.vx = 0; e.vy = 0;
      } else if (e.state !== 'flee') {
        if (e.stateTimer <= 0) {
          e.stateTimer = 80 + Math.floor(Math.sin(e.phase * 17.3) * 40 + 40);
          e.state = Math.sin(e.phase + wavePhase * 0.1) > 0 ? 'wander' : 'idle';
          if (e.state === 'wander') {
            const angle = wavePhase * 0.7 + e.phase * 3.1;
            e.vx = Math.cos(angle) * 0.022 * spd;
            e.vy = Math.sin(angle) * 0.022 * spd;
          } else {
            e.vx = 0; e.vy = 0;
          }
        }
      }

    } else if (e.kind === 'bird') {
      // Flock — all birds in flock share state based on flock leader (first bird)
      if (distToPlayer < 4 && e.state !== 'flee') {
        e.state = 'flee';
        e.stateTimer = 200;
        const angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.2;
        e.vx = Math.cos(angle) * 0.07 * spd;
        e.vy = Math.sin(angle) * 0.07 * spd;
      } else if (e.state === 'flee') {
        if (e.stateTimer <= 0) {
          e.state = 'idle'; e.vx *= 0.95; e.vy *= 0.95;
        }
      } else {
        // Gentle drift
        e.vx = Math.sin(wavePhase * 0.4 + e.phase) * 0.006 * spd;
        e.vy = Math.cos(wavePhase * 0.3 + e.phase) * 0.006 * spd;
      }

    } else if (e.kind === 'wolf') {
      if (e.state !== 'hunt' && distToPlayer < 8) {
        e.state = 'hunt';
      } else if (e.state === 'hunt' && distToPlayer > 12) {
        e.state = 'wander'; e.stateTimer = 100;
      }
      if (e.state === 'hunt') {
        const len = distToPlayer || 1;
        let speed = 0.04 * spd;
        // Slowed by water veil
        if (waterVeilTimer > 0 && distToPlayer < 3) speed = 0;
        // Knocked back by earth pulse (handled as instant, velocity set there)
        e.vx = (dx / len) * speed + e.vx * 0.8;
        e.vy = (dy / len) * speed + e.vy * 0.8;
      } else {
        if (e.stateTimer <= 0) {
          const angle = wavePhase * 0.5 + e.phase * 2.7;
          e.vx = Math.cos(angle) * 0.018 * spd;
          e.vy = Math.sin(angle) * 0.018 * spd;
          e.stateTimer = 120;
        }
      }

      // Wolf contact — drain essence
      if (distToPlayer < 1.2 && waterVeilTimer <= 0 && windStepTimer <= 0) {
        save.essence = Math.max(0, save.essence - 0.4 * spd);
        essenceFlash = 8;
      }

    } else if (e.kind === 'fox') {
      // Lead toward nearest uncollected rune
      if (foxTargetRune) {
        const rdx = foxTargetRune.tx - e.x, rdy = foxTargetRune.ty - e.y;
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rdist > 1.5) {
          const len = rdist || 1;
          e.vx = (rdx / len) * 0.025 * spd;
          e.vy = (rdy / len) * 0.025 * spd;
        } else {
          e.vx = Math.sin(wavePhase * 0.8 + e.phase) * 0.01 * spd;
          e.vy = Math.cos(wavePhase * 0.6 + e.phase) * 0.01 * spd;
        }
      }
    }

    // Move (with passability check for deer/fox/wolf — birds fly)
    if (e.kind === 'bird') {
      e.x += e.vx; e.y += e.vy;
    } else {
      const nx = e.x + e.vx, ny = e.y + e.vy;
      if (passable(nx, e.y)) e.x = nx; else e.vx *= -0.5;
      if (passable(e.x, ny)) e.y = ny; else e.vy *= -0.5;
    }
    // Keep entities within world bounds (loose)
    e.x = Math.max(2, Math.min(WORLD_W - 2, e.x));
    e.y = Math.max(2, Math.min(WORLD_H - 2, e.y));
  }
}

// ── Spell logic ────────────────────────────────────────────────────────────────

const SPELL_COSTS: Record<RuneKind, number> = { fire: 20, water: 15, earth: 25, wind: 10 };

function castSpell(kind: RuneKind) {
  if (!save.collectedRunes.includes(kind)) return;
  if (save.essence < SPELL_COSTS[kind]) return;
  if (spellCooldown > 0) return;

  save.essence -= SPELL_COSTS[kind];
  spellCooldown = 20;

  if (kind === 'fire') {
    const dirV: Record<string, [number, number]> = {
      up: [0, -0.18], down: [0, 0.18], left: [-0.18, 0], right: [0.18, 0],
    };
    const [ovx, ovy] = dirV[player.dir];
    activeSpells.push({ kind: 'fire', timer: 55, ox: player.x, oy: player.y, ovx, ovy });
    playSpellSound('fire');
  } else if (kind === 'water') {
    waterVeilTimer = 240; // 4s at 60fps
    playSpellSound('water');
  } else if (kind === 'earth') {
    // Instant knockback to wolves within 5 tiles
    for (const e of entities) {
      if (e.kind !== 'wolf' || !e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5) {
        const len = dist || 1;
        e.vx += (dx / len) * 0.4;
        e.vy += (dy / len) * 0.4;
        e.state = 'wander'; e.stateTimer = 120;
      }
    }
    // Screen shake via overlay flash
    essenceFlash = 0;
    playSpellSound('earth');
    // Visual: brief earth ring
    activeSpells.push({ kind: 'earth', timer: 30 });
  } else if (kind === 'wind') {
    windStepTimer = 180; // 3s
    playSpellSound('wind');
  }
}

function updateSpells(dt: number) {
  const spd = dt / 16.67;
  if (spellCooldown > 0) spellCooldown--;
  if (waterVeilTimer > 0) waterVeilTimer--;
  if (windStepTimer  > 0) windStepTimer--;

  // Update fire orb
  for (let i = activeSpells.length - 1; i >= 0; i--) {
    const sp = activeSpells[i];
    sp.timer--;
    if (sp.kind === 'fire' && sp.ox !== undefined) {
      sp.ox! += sp.ovx! * spd * 60 / 60;
      sp.oy! += sp.ovy! * spd * 60 / 60;
      // Hit wolf
      for (const e of entities) {
        if (e.kind !== 'wolf' || !e.alive) continue;
        const dx = sp.ox! - e.x, dy = sp.oy! - e.y;
        if (Math.sqrt(dx * dx + dy * dy) < 1.0) {
          e.alive = false;
          // Respawn wolf after 30s
          setTimeout(() => { e.alive = true; e.x = 8; e.y = 18; e.state = 'idle'; }, 30000);
          sp.timer = 0;
          playDiscoveryChime();
        }
      }
      // Hit wall
      if (!passable(sp.ox!, sp.oy!)) sp.timer = 0;
    }
    if (sp.timer <= 0) { activeSpells.splice(i, 1); }
  }

  // Essence regen — standing still on grass/sand/path
  const tile = tileAt(player.x, player.y);
  const onRest = tile === T.GRASS || tile === T.GRASS_LIGHT || tile === T.SAND || tile === T.PATH;
  if (onRest && !player.moving) {
    save.essence = Math.min(ESSENCE_MAX, save.essence + 0.08 * spd);
  }
  // Wind step — extra speed handled in movePlayer
  if (essenceFlash > 0) essenceFlash--;
}

// ── Rune collection ────────────────────────────────────────────────────────────

function collectNearbyRune() {
  if (!spiritMode) return;
  for (const rune of RUNES) {
    if (save.collectedRunes.includes(rune.kind)) continue;
    const dx = player.x - rune.tx, dy = player.y - rune.ty;
    if (Math.sqrt(dx * dx + dy * dy) < 1.8) {
      save.collectedRunes.push(rune.kind);
      if (!save.discoveries.includes(rune.discoveryId)) {
        save.discoveries.push(rune.discoveryId);
        playDiscoveryChime();
      }
      openDialog({
        id: `rune_collect_${rune.kind}`,
        tx: rune.tx, ty: rune.ty, range: 2,
        prompt: '',
        lines: [rune.runeDesc, rune.spellDesc],
      });
      return true;
    }
  }
  return false;
}

// ── Weather events ─────────────────────────────────────────────────────────────

function updateWeather(dt: number) {
  const spd = dt / 16.67;

  // Ghost ship drifts slowly offshore (fog days)
  if (atmosphere === 'fog') {
    ghostShipX += 0.004 * spd;
    if (ghostShipX > WORLD_W + 10) ghostShipX = -12;
  }

  // Whale — trigger once, random time 3–8 min in
  if (!whaleDone && whaleTimer <= 0) {
    whaleTimer = Math.floor(3 * 3600 + Math.sin(save.playTime) * 3 * 3600);
  }
  if (!whaleDone && whaleTimer > 0) {
    whaleTimer -= spd;
    if (whaleTimer <= 0 && !whaleDone) {
      whaleDone = true;
      // Pick a deep-water spot offshore (south of island)
      whaleX = 20 + Math.floor(Math.abs(Math.sin(save.playTime * 7)) * 10);
      whaleY = WORLD_H + 3;
      whaleAnim = 160;
    }
  }
  if (whaleAnim > 0) { whaleAnim -= spd; if (whaleAnim < 0) whaleAnim = 0; }

  // Lightning — check every ~5 min (18000 frames @ 60fps)
  if (lightningFlash > 0) { lightningFlash -= spd; return; }
  if (lightningTimer <= 0) {
    lightningTimer = 10000 + Math.floor(Math.abs(Math.sin(wavePhase * 0.7)) * 8000);
  }
  lightningTimer -= spd;
  if (lightningTimer <= 0) {
    lightningFlash = 8;
    thunderScheduled = true;
    if (audioCtx) {
      setTimeout(() => {
        if (!audioCtx || !thunderScheduled) return;
        thunderScheduled = false;
        playThunder();
      }, 800 + Math.random() * 600);
    }
  }
}

// ── Audio helpers ─────────────────────────────────────────────────────────────

function playSpellSound(kind: RuneKind) {
  if (!audioCtx) return;
  if (kind === 'fire') {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 800;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.15;
    src.connect(bpf); bpf.connect(gain); gain.connect(audioCtx.destination);
    src.start();
  } else if (kind === 'water') {
    const freqs = [440, 554, 659];
    freqs.forEach((f, i) => {
      const osc = audioCtx!.createOscillator();
      const g   = audioCtx!.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      g.gain.setValueAtTime(0.08, audioCtx!.currentTime + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + i * 0.08 + 0.8);
      osc.connect(g); g.connect(audioCtx!.destination);
      osc.start(audioCtx!.currentTime + i * 0.08);
      osc.stop(audioCtx!.currentTime + i * 0.08 + 0.9);
    });
  } else if (kind === 'earth') {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.4);
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
  } else if (kind === 'wind') {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.4, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bpf = audioCtx.createBiquadFilter();
    bpf.type = 'highpass'; bpf.frequency.value = 2000;
    const g = audioCtx.createGain(); g.gain.value = 0.1;
    src.connect(bpf); bpf.connect(g); g.connect(audioCtx.destination);
    src.start();
  }
}

function playThunder() {
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.5, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.4));
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 200;
  const g = audioCtx.createGain(); g.gain.value = 0.8;
  src.connect(lpf); lpf.connect(g); g.connect(audioCtx.destination);
  src.start();
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let lastTime = 0;
let rafId    = 0;

function loop(now: number) {
  rafId      = requestAnimationFrame(loop);
  const dt   = Math.min(now - lastTime, 50);
  lastTime   = now;

  // Resize canvas
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Advance game time — 1 real second = 2 in-game minutes
  const realDelta = (now - lastRealTime) / 1000;
  lastRealTime    = now;
  dayTime = (dayTime + realDelta * 2) % 1440;
  save.playTime  += realDelta;

  wavePhase += 0.03;

  // Help toggle (H key)
  if (hJustPressed) {
    hJustPressed = false;
    helpPanelOpen = !helpPanelOpen;
    discPanelOpen = false;
    dialogActive  = false;
  }

  // Spirit mode toggle (F key)
  if (fJustPressed && !dialogActive) {
    fJustPressed = false;
    spiritMode = !spiritMode;
  } else {
    fJustPressed = false;
  }
  // Animate spirit overlay
  const spiritTarget = spiritMode ? 1 : 0;
  spiritAlpha += (spiritTarget - spiritAlpha) * 0.07;
  if (spiritAlpha < 0.01) spiritAlpha = 0;
  if (spiritAlpha > 0.99) spiritAlpha = 1;

  // Move player (wind step doubles speed)
  movePlayer(dt);

  // Zone detection
  const zone = currentZone();
  if (zone !== lastZone && zone !== '') {
    zoneName      = zone;
    zoneNameTimer = 120;
    lastZone      = zone;
  }
  if (zoneNameTimer > 0) zoneNameTimer--;

  // Nearby interactable — base + daily + layer 2 (when unlocked)
  nearbyInteractable = null;
  const layer2On = save.discoveries.length >= DISCOVERIES.length;
  const searchObjs: Interactable[] = [
    ...INTERACTABLES,
    ...dailyNotes,
    ...(layer2On ? LAYER2_INTERACTABLES : []),
  ];
  for (const obj of searchObjs) {
    const dx = player.x - obj.tx, dy = player.y - obj.ty;
    if (Math.sqrt(dx*dx + dy*dy) <= obj.range) {
      nearbyInteractable = obj;
      break;
    }
  }

  // B key — build mode toggle
  if (bJustPressed) {
    bJustPressed = false;
    buildMode = !buildMode;
    if (!buildMode) selectedBuildKind = null;
    dialogActive = false;
    discPanelOpen = false;
    helpPanelOpen = false;
    shipCraftMenuOpen = false;
    techPanelOpen = false;
    inventoryOpen = false;
  }

  // T key — tech panel
  if (tJustPressed) {
    tJustPressed = false;
    if (!dialogActive && !buildMode) {
      techPanelOpen = !techPanelOpen;
      inventoryOpen = false;
    }
  }

  // I key — inventory / craft panel
  if (iJustPressed) {
    iJustPressed = false;
    if (!dialogActive && !buildMode) {
      inventoryOpen = !inventoryOpen;
      techPanelOpen = false;
      // detect nearest building for crafting context
      craftTarget = null;
      let bestD = 2.5;
      for (const b of save.buildings) {
        const d = Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2);
        if (d < bestD) { bestD = d; craftTarget = b.kind; }
      }
    }
  }

  // Space — player attack
  if (spaceJustPressed) {
    spaceJustPressed = false;
    if (!dialogActive && !isDead) playerAttack();
  }

  // Death respawn
  if (isDead) {
    deathFade = Math.min(1, deathFade + 0.02);
    if (keys['r'] || keys['R']) {
      isDead = false; deathFade = 0;
      player.x = save.respawnX ?? 24; player.y = save.respawnY ?? 30;
      save.hp = PLAYER_MAX_HP * 0.5;
      save.hunger = 60;
      // Lose 20% resources
      save.resources.wood  = Math.floor(save.resources.wood  * 0.8);
      save.resources.stone = Math.floor(save.resources.stone * 0.8);
      save.resources.food  = Math.floor(save.resources.food  * 0.8);
      save.resources.coin  = Math.floor(save.resources.coin  * 0.8);
    }
  }

  // E key interaction
  if (eJustPressed) {
    eJustPressed = false;
    if (dialogActive) {
      if (!dialogJustOpened) advanceDialog();
      dialogJustOpened = false;
    } else if (techPanelOpen) {
      // Research first affordable tech at workshop
      const atWs = save.buildings.some(b => b.kind === 'workshop' &&
        Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 3);
      if (atWs) {
        const tech = TECH_DEFS.find(t => !save.researched.includes(t.id as any) && canAfford(save.resources, t.cost));
        if (tech) {
          deductCost(save.resources, tech.cost);
          save.researched.push(tech.id as any);
          eraBannerText = `✦  ${tech.label} researched  ✦`; eraBannerTimer = 180;
        }
      }
    } else if (inventoryOpen && craftTarget) {
      // Craft first affordable item at this building
      const available = ITEM_DEFS.filter(i => i.craftAt === craftTarget);
      const craftable = available.find(def => canAfford(save.resources, def.cost));
      if (craftable) {
        deductCost(save.resources, craftable.cost);
        const existing = save.inventory.find(i => i.kind === craftable.kind as any);
        if (existing) existing.qty++;
        else save.inventory.push({ kind: craftable.kind as any, qty: 1 });
        eraBannerText = `✦  Crafted ${craftable.label}  ✦`; eraBannerTimer = 120;
      }
    } else if (shipCraftMenuOpen) {
      if (save.shipParts.length === SHIP_PARTS.length) {
        escapePhase = 1;
        shipCraftMenuOpen = false;
      } else {
        const next = SHIP_PARTS.find(p => !save.shipParts.includes(p.id));
        if (next && canAfford(save.resources, next.cost)) craftShipPart(next.id);
      }
    } else if (!discPanelOpen && !buildMode && !isDead) {
      initAudio();

      // Check NPC proximity first
      let npcHandled = false;
      for (const npcId of npcsActive) {
        const npc = NPC_DEFS.find(n => n.id === npcId);
        if (!npc) continue;
        const d = Math.sqrt((player.x - npc.tx) ** 2 + (player.y - npc.ty) ** 2);
        if (d < 2) { handleNpcInteract(npcId); npcHandled = true; break; }
      }

      if (!npcHandled) {
        // Shelter rest
        const atShelter = save.buildings.some(b => b.kind === 'shelter' &&
          Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 2.5);
        if (atShelter) {
          save.hp     = PLAYER_MAX_HP;
          save.hunger = Math.min(PLAYER_MAX_HUNGER, (save.hunger ?? 100) + 50);
          save.essence = ESSENCE_MAX;
          save.respawnX = player.x; save.respawnY = player.y;
          eraBannerText = '✦  Rested  ✦'; eraBannerTimer = 120;
        } else {
          // Workshop tech panel shortcut
          const atWorkshop = save.buildings.some(b => b.kind === 'workshop' &&
            Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 2.5);
          if (atWorkshop) { techPanelOpen = true; }
          else {
            const runeCollected = collectNearbyRune();
            if (!runeCollected) {
              const node = nearbyResourceNode();
              if (node) {
                gatherResource(node.id);
              } else if (nearDock) {
                shipCraftMenuOpen = true;
              } else if (nearbyInteractable) {
                openDialog(nearbyInteractable);
              }
            }
          }
        }
      }
    }
  }

  // Spell key input
  if (spellKeyPress) {
    castSpell(spellKeyPress);
    spellKeyPress = null;
  }

  // Check near dock
  nearDock = save.buildings.some(b => {
    if (b.kind !== 'dock') return false;
    const dx = player.x - b.tx, dy = player.y - b.ty;
    return Math.sqrt(dx * dx + dy * dy) < 2.5;
  });

  // Era banner tick
  if (eraBannerTimer > 0) eraBannerTimer--;

  // Gather flash tick
  if (gatherFlash) {
    gatherFlash.timer--;
    if (gatherFlash.timer <= 0) gatherFlash = null;
  }

  // Escape animation
  if (escapePhase === 1) {
    escapeFade = Math.min(1, escapeFade + 0.015);
    if (escapeFade >= 1) escapePhase = 2;
  }
  if (escapePhase === 2) {
    // Handle R/N keys on victory screen
    if (keys['r'] || keys['R']) { escapePhase = 0; escapeFade = 0; }
    if (keys['n'] || keys['N']) { save = { ...save, buildings: [], resources: { wood: 0, stone: 0, food: 0, coin: 0 }, era: 1, shipParts: [] }; escapePhase = 0; escapeFade = 0; }
  }

  // Entity + spell + weather + survival + forest updates
  updateEntities(dt);
  updateSpells(dt);
  updateWeather(dt);
  updateSurvival(dt);
  updateRaiders(dt);
  updateForest(dt);
  tickTrainQueue(dt, units, save);
  updateUnits(units, save, dt, [...entities, ...raiders], passable);
  if (attackFlash > 0) attackFlash--;
  if (attackCooldown > 0) attackCooldown--;

  // P key — plant mode
  if (pJustPressed) {
    pJustPressed = false;
    if (!dialogActive) {
      plantMode = !plantMode;
      if (!plantMode) { selectedSpeciesId = null; buildMode = false; }
      else { buildMode = false; selectedBuildKind = null; }
    }
  }

  // Save timer
  if (saveStatusTimer > 0) saveStatusTimer--;
  if (now - lastAutoSave > SAVE_EVERY) {
    lastAutoSave = now;
    triggerSave();
  }

  // ── Draw ──
  ctx.fillStyle = skyColor();
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  drawWorld();
  drawFireflies();
  drawGhostShip();
  drawWhale();
  drawAtmosphere();
  drawEntities();
  drawInteractableSprites();
  drawSpiritOverlay();
  drawRunes();
  drawSpellEffects();
  drawPlayer();

  // Day/night overlay
  const ov = lightOverlay();
  if (ov.alpha > 0) {
    ctx.fillStyle   = ov.color;
    ctx.globalAlpha = ov.alpha;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  // Lightning flash
  if (lightningFlash > 0) {
    ctx.fillStyle   = `rgba(255,255,255,${(lightningFlash / 8) * 0.7})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Essence drain vignette (red when wolf near)
  if (essenceFlash > 0) {
    ctx.fillStyle   = `rgba(180,0,0,${essenceFlash / 8 * 0.4})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Wolf proximity vignette
  const isNightRender = dayTime < 420 || dayTime >= 1020;
  if (isNightRender) {
    const nearWolf = entities.some(e => e.kind === 'wolf' && e.alive && (() => {
      const dx = player.x - e.x, dy = player.y - e.y;
      return Math.sqrt(dx * dx + dy * dy) < 5;
    })());
    if (nearWolf) {
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.25,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.6,
      );
      const pulse = Math.sin(wavePhase * 3) * 0.15 + 0.25;
      grad.addColorStop(0, 'rgba(120,0,0,0)');
      grad.addColorStop(1, `rgba(120,0,0,${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawForestLayer();
  drawResourceNodes();
  drawBuildings();
  drawEnemyCamp();
  drawUnits();
  drawAttackArc();
  drawNPCs();
  drawSeasonTint();
  drawFog();
  drawZoneBanner();
  drawEraBanner();
  drawRaidWarning();
  drawInteractPrompt();
  drawDialog();
  drawShipCraftPanel();
  drawDiscoveries();
  drawHelp();
  drawBuildMode();
  drawTechPanel();
  drawInventoryPanel();
  drawPlantPanel();
  drawBiodiversityHUD();
  drawEducationPopup();
  drawGatherFlash();
  drawSurvivalHUD();
  drawSanityEffects();
  drawHUD();
  drawResourceHUD();
  drawSpiritHUD();
  drawEssenceBar();
  drawMinimap();
  drawDeath();
  drawVictory();
}

// ── Save trigger ──────────────────────────────────────────────────────────────

function triggerSave() {
  save.px         = player.x;
  save.py         = player.y;
  save.dir        = player.dir;
  save.lastSaved  = new Date().toISOString();
  onSave(save, saveSha)
    .then(sha => {
      saveSha         = sha;
      saveStatus      = '✓ saved';
      saveStatusTimer = 90;
    })
    .catch(() => {
      saveStatus      = '✗ save failed';
      saveStatusTimer = 90;
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startGame(
  initialSave: SaveState,
  sha: string | null,
  saveCallback: (s: SaveState, sha: string | null) => Promise<string>,
) {
  save       = initialSave;
  // Migrate older saves missing new fields
  if (save.collectedRunes === undefined) save.collectedRunes = [];
  if (save.essence        === undefined) save.essence        = ESSENCE_MAX;
  if (save.resources      === undefined) save.resources      = { wood: 0, stone: 0, food: 0, coin: 0 };
  if (save.buildings      === undefined) save.buildings      = [];
  if (save.era            === undefined) save.era            = 1;
  if (save.shipParts      === undefined) save.shipParts      = [];
  if (save.hp             === undefined) save.hp             = 100;
  if (save.hunger         === undefined) save.hunger         = 100;
  if (save.sanity         === undefined) save.sanity         = 100;
  if (save.researched     === undefined) save.researched     = [];
  if (save.inventory      === undefined) save.inventory      = [];
  if (save.equippedItem   === undefined) save.equippedItem   = null;
  if (save.season         === undefined) save.season         = 'summer';
  if (save.seasonTimer    === undefined) save.seasonTimer    = 120;
  if (save.explored       === undefined) save.explored       = [];
  if (save.respawnX       === undefined) save.respawnX       = save.px;
  if (save.respawnY       === undefined) save.respawnY       = save.py;
  if (save.enemyCampHp    === undefined) save.enemyCampHp    = 400;
  if (save.raidLevel      === undefined) save.raidLevel      = 1;
  if (save.dayCount       === undefined) save.dayCount       = 0;
  if (save.plantedTiles   === undefined) save.plantedTiles   = {};
  if (save.threatCamps    === undefined) save.threatCamps    = [];
  if (save.biodiversityLog=== undefined) save.biodiversityLog= [];
  if (save.carbonCredits  === undefined) save.carbonCredits  = 0;
  // Ensure starting threat camp exists
  if (save.threatCamps.length === 0) {
    save.threatCamps.push({
      id: 'camp_logging_start',
      threatId: 'industrial_logging',
      tx: CAMP_X, ty: CAMP_Y,
      hp: STARTING_THREAT.hp, maxHp: STARTING_THREAT.maxHp,
      educationShown: false,
    });
  }
  // Init runtime state
  fogGrid = initFog();
  units = [];
  raiders = [];
  selectedUnits = [];
  npcsActive = NPC_DEFS.filter(n => n.spawnEra <= save.era).map(n => n.id);
  lastDayCount = Math.floor((save.playTime ?? 0) / 120);
  biodiversityIndex = calcBiodiversityIndex();
  saveSha    = sha;
  onSave     = saveCallback;
  world      = buildWorld();
  dailyNotes = getDailyNotes();
  atmosphere = getDailyAtmosphere();
  entities   = spawnEntities();
  // Reset whale for this session
  whaleDone  = false;
  whaleTimer = 0;
  ghostShipX = -8.0;

  // Show atmosphere as an opening banner
  const atmMsg: Record<Atmosphere, string> = {
    fog:    'A thick fog clings to the island',
    mist:   'Morning mist drifts through the trees',
    rain:   'Rain falls softly on the island',
    golden: 'Golden light fills the island today',
    clear:  '',
  };
  if (atmMsg[atmosphere]) {
    zoneName      = atmMsg[atmosphere];
    zoneNameTimer = 220;
    lastZone      = '__atmosphere__';
  }

  player = {
    x:         save.px,
    y:         save.py,
    dir:       save.dir,
    moving:    false,
    frame:     0,
    frameTimer: 0,
  };

  canvas     = document.getElementById('game') as HTMLCanvasElement;
  ctx        = canvas.getContext('2d')!;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Input
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'e' || e.key === 'E') eJustPressed = true;
    if (e.key === 'f' || e.key === 'F') fJustPressed = true;
    if (['1','2','3','4','5','6','7','8','9','0'].includes(e.key)) {
      if (buildMode) {
        // Number keys select building in build mode
        const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
        if (idx < BUILDING_DEFS.length) {
          const def = BUILDING_DEFS[idx];
          const alreadyBuilt = def.unique && save.buildings.some(b => b.kind === def.kind);
          if (!alreadyBuilt && canAfford(save.resources, def.cost))
            selectedBuildKind = selectedBuildKind === def.kind ? null : def.kind;
        }
      } else {
        if (e.key === '1') spellKeyPress = 'fire';
        if (e.key === '2') spellKeyPress = 'water';
        if (e.key === '3') spellKeyPress = 'earth';
        if (e.key === '4') spellKeyPress = 'wind';
      }
    }
    if (buildMode && e.key === 'Enter' && selectedBuildKind) {
      placeBuilding(selectedBuildKind, Math.floor(player.x), Math.floor(player.y));
      selectedBuildKind = null;
    }
    if (e.key === 'Tab') { e.preventDefault(); discPanelOpen = !discPanelOpen; dialogActive = false; helpPanelOpen = false; }
    if (e.key === 'h' || e.key === 'H') { hJustPressed = true; }
    if (e.key === 'b' || e.key === 'B') { bJustPressed = true; }
    if (e.key === 't' || e.key === 'T') { tJustPressed = true; }
    if (e.key === 'i' || e.key === 'I') { iJustPressed = true; }
    if (e.key === 'p' || e.key === 'P') { pJustPressed = true; }
    if (e.key === ' ') { e.preventDefault(); spaceJustPressed = true; }
    if (plantMode && e.key === 'ArrowRight') speciesPanelPage++;
    if (plantMode && e.key === 'ArrowLeft')  speciesPanelPage = Math.max(0, speciesPanelPage - 1);
    if (e.key === 'v' || e.key === 'V') {
      // Train villager at nearest shelter
      const sh = save.buildings.find(b => b.kind === 'shelter' &&
        Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 3);
      if (sh) queueTrain('villager', save, sh.tx, sh.ty);
    }
    if (e.key === 'z' || e.key === 'Z') {
      // Train soldier at nearest workshop
      const ws = save.buildings.find(b => b.kind === 'workshop' &&
        Math.sqrt((player.x - b.tx) ** 2 + (player.y - b.ty) ** 2) < 3);
      if (ws) queueTrain('soldier', save, ws.tx, ws.ty);
    }
    if (e.key === 'Escape') {
      dialogActive = false; discPanelOpen = false; helpPanelOpen = false;
      buildMode = false; selectedBuildKind = null; shipCraftMenuOpen = false;
      techPanelOpen = false; inventoryOpen = false;
      plantMode = false; selectedSpeciesId = null;
    }
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // Mouse tracking for build mode
  canvas.addEventListener('mousemove', e => {
    mouseScreenX = e.clientX;
    mouseScreenY = e.clientY;
  });

  // Right-click: unit command (move / attack)
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (selectedUnits.length === 0) return;
    const camX = player.x * TILE_PX - canvas.width  / 2;
    const camY = player.y * TILE_PX - canvas.height / 2;
    const wx = (e.clientX + camX) / TILE_PX;
    const wy = (e.clientY + camY) / TILE_PX;
    // Check if right-clicking near an enemy
    const enemy = [...entities, ...raiders].find(en => {
      if (!en.alive) return false;
      return Math.sqrt((en.x - wx) ** 2 + (en.y - wy) ** 2) < 1.0;
    });
    for (const id of selectedUnits) {
      const u = units.find(u => u.id === id);
      if (!u) continue;
      if (enemy && u.kind === 'soldier') {
        u.task = 'attacking'; u.taskTarget = enemy.id;
        u.targetX = enemy.x; u.targetY = enemy.y;
      } else {
        // Check resource node
        const node = RESOURCE_NODES.find(n => {
          return Math.sqrt((n.tx - wx) ** 2 + (n.ty - wy) ** 2) < 1.2;
        });
        if (node && u.kind === 'villager') {
          u.task = 'gathering'; u.taskTarget = node.id;
        } else {
          u.task = 'moving'; u.taskTarget = null;
          u.targetX = wx; u.targetY = wy;
        }
      }
    }
  });

  // Click handler: unit selection + build placement + help button
  canvas.addEventListener('click', e => {
    // [?] button
    const bx = canvas.width - 36, by = canvas.height - 58;
    if (e.clientX >= bx && e.clientX <= bx + 28 && e.clientY >= by && e.clientY <= by + 22) {
      helpPanelOpen = !helpPanelOpen;
      discPanelOpen = false;
      dialogActive  = false;
      return;
    }

    // Plant mode: select species from panel or plant on world
    if (plantMode) {
      const PAGE = SPECIES_PER_PAGE;
      const allSpecies = SPECIES;
      const visible = allSpecies.slice(speciesPanelPage * PAGE, (speciesPanelPage + 1) * PAGE);
      const W = 380, ROW = 52, PAD = 12;
      const H = visible.length * ROW + 88;
      const panX = (canvas.width - W) / 2, panY = (canvas.height - H) / 2;
      if (e.clientX >= panX && e.clientX <= panX + W && e.clientY >= panY && e.clientY <= panY + H) {
        // Clicked inside panel — select species
        const relY = e.clientY - (panY + PAD + 38);
        const idx = Math.floor(relY / ROW);
        if (idx >= 0 && idx < visible.length) {
          selectedSpeciesId = visible[idx].id === selectedSpeciesId ? null : visible[idx].id;
        }
        return;
      } else if (selectedSpeciesId) {
        // Clicked world — plant selected species
        const camX = player.x * TILE_PX - canvas.width  / 2;
        const camY = player.y * TILE_PX - canvas.height / 2;
        const tx = Math.floor((e.clientX + camX) / TILE_PX);
        const ty = Math.floor((e.clientY + camY) / TILE_PX);
        plantSpecies(selectedSpeciesId, tx, ty);
        return;
      }
    }

    // Unit selection
    if (!buildMode && !plantMode) {
      const camX = player.x * TILE_PX - canvas.width  / 2;
      const camY = player.y * TILE_PX - canvas.height / 2;
      const wx = (e.clientX + camX) / TILE_PX;
      const wy = (e.clientY + camY) / TILE_PX;
      const hit = units.find(u => u.alive && Math.sqrt((u.x - wx) ** 2 + (u.y - wy) ** 2) < 0.7);
      if (hit) {
        if (e.shiftKey) {
          if (selectedUnits.includes(hit.id)) selectedUnits = selectedUnits.filter(id => id !== hit.id);
          else selectedUnits.push(hit.id);
        } else {
          selectedUnits = [hit.id];
        }
        for (const u of units) u.selected = selectedUnits.includes(u.id);
        return;
      } else if (!e.shiftKey) {
        selectedUnits = [];
        for (const u of units) u.selected = false;
      }
    }

    // Build mode: select building from panel or place on world
    if (buildMode) {
      const ROW_H = 26;
      const PW = 272, PH = BUILDING_DEFS.length * ROW_H + 58;
      const PX = canvas.width - PW - 14;
      const PY = (canvas.height - PH) / 2;

      if (e.clientX >= PX && e.clientX <= PX + PW && e.clientY >= PY && e.clientY <= PY + PH) {
        // Clicked the panel — select a building by row
        const row = Math.floor((e.clientY - (PY + 40)) / ROW_H);
        if (row >= 0 && row < BUILDING_DEFS.length) {
          const def = BUILDING_DEFS[row];
          const alreadyBuilt = def.unique && save.buildings.some(b => b.kind === def.kind);
          if (!alreadyBuilt && canAfford(save.resources, def.cost)) {
            selectedBuildKind = selectedBuildKind === def.kind ? null : def.kind;
          }
        }
        return;
      } else if (selectedBuildKind) {
        // Clicked world — place building
        const tx = Math.floor(e.clientX / TILE_PX + player.x - canvas.width  / 2 / TILE_PX);
        const ty = Math.floor(e.clientY / TILE_PX + player.y - canvas.height / 2 / TILE_PX);
        placeBuilding(selectedBuildKind, tx, ty);
        selectedBuildKind = null;
      }
    }
  });

  // Trigger initial save after 3s to create the file
  setTimeout(() => {
    lastAutoSave = performance.now();
    triggerSave();
  }, 3000);

  lastRealTime = performance.now();
  lastTime     = lastRealTime;
  rafId = requestAnimationFrame(loop);
}

export function stopGame() {
  cancelAnimationFrame(rafId);
}
