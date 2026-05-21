import { T, WORLD_W, WORLD_H } from './types';
import type { TileDef, Player, Interactable, SaveState, Entity, RuneKind, ActiveSpell } from './types';
import {
  TILE_DEFS, buildWorld, INTERACTABLES, DISCOVERIES,
  outerTile, getDailyNotes, getDailyAtmosphere,
  LAYER2_INTERACTABLES, LAYER2_DISCOVERIES,
  RUNES, RUNE_DISCOVERIES, spawnEntities,
} from './world';
import type { Atmosphere } from './world';

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

  // Time of day (subtle, bottom-right corner)
  const hours = Math.floor(dayTime / 60);
  const mins  = String(Math.floor(dayTime % 60)).padStart(2, '0');
  const ampm  = hours >= 12 ? 'pm' : 'am';
  const h12   = hours % 12 === 0 ? 12 : hours % 12;
  const timeStr = `${h12}:${mins}${ampm}`;
  ctx.fillStyle  = 'rgba(180,160,80,0.25)';
  ctx.font       = '10px "Courier New", monospace';
  ctx.textAlign  = 'right';
  ctx.fillText(timeStr, canvas.width - 16, canvas.height - 12);
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
  if (dialogActive || discPanelOpen) return;

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

  // E key interaction
  if (eJustPressed) {
    eJustPressed = false;
    if (dialogActive) {
      if (!dialogJustOpened) advanceDialog();
      dialogJustOpened = false;
    } else if (!discPanelOpen) {
      initAudio();
      // Rune collection takes priority in spirit mode
      const runeCollected = collectNearbyRune();
      if (!runeCollected && nearbyInteractable) {
        openDialog(nearbyInteractable);
      }
    }
  }

  // Spell key input
  if (spellKeyPress) {
    castSpell(spellKeyPress);
    spellKeyPress = null;
  }

  // Entity + spell + weather updates
  updateEntities(dt);
  updateSpells(dt);
  updateWeather(dt);

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

  drawZoneBanner();
  drawInteractPrompt();
  drawDialog();
  drawDiscoveries();
  drawHUD();
  drawSpiritHUD();
  drawEssenceBar();
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
    if (e.key === '1') spellKeyPress = 'fire';
    if (e.key === '2') spellKeyPress = 'water';
    if (e.key === '3') spellKeyPress = 'earth';
    if (e.key === '4') spellKeyPress = 'wind';
    if (e.key === 'Tab') { e.preventDefault(); discPanelOpen = !discPanelOpen; dialogActive = false; }
    if (e.key === 'Escape') { dialogActive = false; discPanelOpen = false; }
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

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
