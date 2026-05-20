import { T, WORLD_W, WORLD_H } from './types';
import type { TileDef, Player, Interactable, SaveState } from './types';
import { TILE_DEFS, buildWorld, INTERACTABLES, DISCOVERIES } from './world';

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
let eJustPressed = false;

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

// Day/night cycle — time in minutes (0–1440)
let dayTime      = 7 * 60; // start at 7am
let lastRealTime = 0;

// Ambient audio context
let audioCtx: AudioContext | null = null;
let oceanGain: GainNode | null    = null;

// ── Tile helpers ─────────────────────────────────────────────────────────────

function tileAt(tx: number, ty: number): T {
  const x = Math.floor(tx), y = Math.floor(ty);
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return T.DEEP_WATER;
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
  for (const obj of INTERACTABLES) {
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

  const found = DISCOVERIES.filter(d => save.discoveries.includes(d.id));
  const W = 300, PAD = 20;
  const H = Math.min(found.length * 44 + 80, canvas.height - 80);
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
  ctx.fillText(`DISCOVERIES  ${found.length}/${DISCOVERIES.length}`, X + W / 2, Y + 28);

  ctx.textAlign = 'left';
  found.forEach((d, i) => {
    const ry = Y + 52 + i * 44;
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

function drawHUD() {
  // Discovery count (top left)
  const n = save.discoveries.length;
  ctx.fillStyle  = 'rgba(0,0,0,0.5)';
  ctx.fillRect(14, 14, 120, 24);
  ctx.fillStyle  = '#7a6838';
  ctx.font       = '11px "Courier New", monospace';
  ctx.fillText(`◇ ${n}/${DISCOVERIES.length} found   [Tab]`, 22, 30);

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

  const spd   = SPEED * (dt / 16.67);
  const nx    = player.x + dx * spd;
  const ny    = player.y + dy * spd;
  const foot  = 0.35; // collision box half-width in tiles

  if (dx !== 0 && passable(nx + Math.sign(dx) * foot, player.y)) player.x = nx;
  if (dy !== 0 && passable(player.x, ny + Math.sign(dy) * foot)) player.y = ny;

  // Clamp to world
  player.x = Math.max(0.5, Math.min(WORLD_W - 0.5, player.x));
  player.y = Math.max(0.5, Math.min(WORLD_H - 0.5, player.y));

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

  // Move player
  movePlayer(dt);

  // Zone detection
  const zone = currentZone();
  if (zone !== lastZone && zone !== '') {
    zoneName      = zone;
    zoneNameTimer = 120;
    lastZone      = zone;
  }
  if (zoneNameTimer > 0) zoneNameTimer--;

  // Nearby interactable
  nearbyInteractable = null;
  for (const obj of INTERACTABLES) {
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
    } else if (nearbyInteractable && !discPanelOpen) {
      initAudio();
      openDialog(nearbyInteractable);
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
  drawInteractableSprites();
  drawPlayer();

  // Day/night overlay
  const ov = lightOverlay();
  if (ov.alpha > 0) {
    ctx.fillStyle   = ov.color;
    ctx.globalAlpha = ov.alpha;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  drawZoneBanner();
  drawInteractPrompt();
  drawDialog();
  drawDiscoveries();
  drawHUD();
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
  save    = initialSave;
  saveSha = sha;
  onSave  = saveCallback;
  world   = buildWorld();

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
