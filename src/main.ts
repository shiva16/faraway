import { verifyToken, ensureRepo, loadSave, writeSave } from './github';
import { startGame } from './game';
import { defaultSave } from './types';
import type { SaveState } from './types';

// ── Ecological facts shown on login ──────────────────────────────────────────

const ECO_FACTS = [
  { stat: '15,000,000,000', text: 'trees are felled every year. Net loss: 10 billion annually.' },
  { stat: '96%', text: 'of North American tallgrass prairie has been destroyed in 200 years.' },
  { stat: '73 million', text: 'sharks killed per year for fin soup — 71% of all shark species now threatened.' },
  { stat: '3 million+', text: 'whales killed in the 20th century alone. Blue whale populations at 3% of original.' },
  { stat: '87%', text: 'of global wetlands destroyed since 1700 — 3× faster than forests.' },
  { stat: '75%', text: 'decline in flying insect populations in 27 years. One third of our food depends on them.' },
  { stat: '55 elephants', text: 'killed DAILY at peak poaching — 95% decline since 1900.' },
  { stat: '300 football fields', text: 'of rainforest cleared EVERY HOUR for palm oil.' },
  { stat: '96%', text: 'of old-growth coast redwood logged. A 2,000-year tree felled in 11 seconds.' },
  { stat: '$23 billion/year', text: 'wildlife trafficking — the 4th largest criminal trade globally.' },
  { stat: '500+ species', text: 'supported by a single Banyan tree. One tree, one city of life.' },
  { stat: '450 million years', text: 'sharks have survived five mass extinctions. 50 years of fishing to undo it.' },
  { stat: '2 remain', text: 'Northern White Rhinos alive. Najin and Fatu. Guarded 24 hours a day.' },
  { stat: '8 million tonnes', text: 'of plastic enter oceans every year — one garbage truck per minute.' },
  { stat: '1,500 kg', text: 'of water stored in a mature Baobab. Ancient ones dying en masse since 2005.' },
];

// ── Forest background — split scene: desolation | restoration ────────────────

const fbg  = document.getElementById('forest-bg') as HTMLCanvasElement;
const fctx = fbg.getContext('2d')!;
let fPhase = 0;
let restoreProgress = 0.35; // 0 = total desolation, 1 = full forest (grows over load time)

function drawForestBackground() {
  fbg.width  = window.innerWidth;
  fbg.height = window.innerHeight;
  const W = fbg.width, H = fbg.height;
  fctx.clearRect(0, 0, W, H);

  const divX = W * restoreProgress; // restoration line

  // ── Left: desolation (barren, stumps, ash) ──
  const leftGrad = fctx.createLinearGradient(0, 0, divX, 0);
  leftGrad.addColorStop(0, '#1a0e06');
  leftGrad.addColorStop(1, '#0e0a04');
  fctx.fillStyle = leftGrad; fctx.fillRect(0, 0, divX, H);

  // Ground
  fctx.fillStyle = '#2a1a0a'; fctx.fillRect(0, H * 0.65, divX, H * 0.35);
  // Stumps
  const stumpCount = Math.floor(divX / 55);
  for (let i = 0; i < stumpCount; i++) {
    const sx = (i / stumpCount) * divX * 0.9 + Math.sin(i * 1.7) * 12;
    const sy = H * 0.63 + Math.sin(i * 0.9) * H * 0.04;
    const sh = (0.04 + Math.sin(i * 2.3) * 0.02) * H;
    fctx.fillStyle = '#3a2010'; fctx.fillRect(sx - 8, sy - sh, 16, sh);
    fctx.fillStyle = '#2a1608'; fctx.fillRect(sx - 12, sy - sh * 0.15, 24, sh * 0.2);
    // Rings
    fctx.strokeStyle = '#4a2a12'; fctx.lineWidth = 1;
    fctx.beginPath(); fctx.ellipse(sx, sy - sh * 0.05, 10, 4, 0, 0, Math.PI * 2); fctx.stroke();
    fctx.beginPath(); fctx.ellipse(sx, sy - sh * 0.05, 6, 2.5, 0, 0, Math.PI * 2); fctx.stroke();
  }
  // Ash wisps drifting
  for (let i = 0; i < 20; i++) {
    const ax = (Math.sin(fPhase * 0.3 + i * 1.3) * 0.5 + 0.5) * divX;
    const ay = H * 0.3 + Math.cos(fPhase * 0.2 + i * 0.8) * H * 0.2;
    fctx.fillStyle = `rgba(180,140,100,${0.04 + Math.sin(fPhase + i) * 0.02})`;
    fctx.beginPath(); fctx.ellipse(ax, ay, 3, 8, Math.sin(fPhase * 0.1 + i) * 0.5, 0, Math.PI * 2); fctx.fill();
  }

  // ── Right: living forest ──
  const rightGrad = fctx.createLinearGradient(divX, 0, W, 0);
  rightGrad.addColorStop(0, '#060e06');
  rightGrad.addColorStop(1, '#040a04');
  fctx.fillStyle = rightGrad; fctx.fillRect(divX, 0, W - divX, H);

  // Forest floor
  fctx.fillStyle = '#0a1a08'; fctx.fillRect(divX, H * 0.65, W - divX, H * 0.35);
  // Undergrowth
  for (let i = 0; i < 30; i++) {
    const fx = divX + (Math.sin(i * 1.4 + 0.7) * 0.5 + 0.5) * (W - divX);
    const fy = H * 0.63 + Math.cos(i * 0.8) * H * 0.04;
    const r = (2 + Math.sin(i * 2.1) * 1.5);
    fctx.fillStyle = i % 3 === 0 ? '#1a4010' : '#204818';
    fctx.beginPath(); fctx.arc(fx, fy, r * 2, 0, Math.PI * 2); fctx.fill();
  }
  // Background trees (far, layered)
  const treeCount = Math.floor((W - divX) / 45);
  for (let i = 0; i < treeCount; i++) {
    const tx = divX + (i / treeCount) * (W - divX) + Math.sin(i * 2.1) * 18;
    const ty = H * 0.62 - Math.sin(i * 0.7) * H * 0.08;
    const trunkH = (0.15 + Math.sin(i * 1.3) * 0.05) * H;
    const crownR = (18 + Math.sin(i * 1.7) * 8);
    const layer = i % 3;
    fctx.fillStyle = layer === 0 ? '#183810' : layer === 1 ? '#204818' : '#1a3c14';
    fctx.fillRect(tx - 4, ty - trunkH * 0.2, 8, trunkH * 0.25);
    fctx.beginPath(); fctx.arc(tx, ty - trunkH * 0.15 - crownR * 0.5, crownR, 0, Math.PI * 2); fctx.fill();
    // Subtle canopy highlight
    fctx.fillStyle = layer === 0 ? '#204a18' : '#284a20';
    fctx.beginPath(); fctx.arc(tx - crownR * 0.2, ty - trunkH * 0.15 - crownR * 0.7, crownR * 0.5, 0, Math.PI * 2); fctx.fill();
  }
  // Fern fronds
  for (let i = 0; i < 15; i++) {
    const fx = divX + (Math.cos(i * 1.9) * 0.5 + 0.5) * (W - divX) * 0.9;
    const fy = H * 0.67;
    fctx.strokeStyle = '#284a18'; fctx.lineWidth = 1.5;
    for (let j = -4; j <= 4; j++) {
      fctx.beginPath();
      fctx.moveTo(fx, fy);
      fctx.quadraticCurveTo(fx + j * 8, fy - 22, fx + j * 14, fy - 10 + Math.abs(j) * 3);
      fctx.stroke();
    }
  }
  // Bioluminescent mushrooms (subtle)
  for (let i = 0; i < 8; i++) {
    const mx = divX + (Math.sin(i * 2.3) * 0.5 + 0.5) * (W - divX) * 0.85;
    const my = H * 0.71 + Math.cos(i * 1.4) * H * 0.02;
    const glow = Math.sin(fPhase * 0.8 + i) * 0.5 + 0.5;
    fctx.fillStyle = `rgba(60,200,120,${0.03 + glow * 0.04})`;
    fctx.beginPath(); fctx.arc(mx, my, 12 + glow * 4, 0, Math.PI * 2); fctx.fill();
    fctx.fillStyle = '#30a860'; fctx.beginPath(); fctx.ellipse(mx, my, 5, 3, 0, 0, Math.PI * 2); fctx.fill();
    fctx.fillStyle = '#2a8048'; fctx.fillRect(mx - 1.5, my, 3, 8);
  }

  // ── Dividing line — the restoration front ──
  const lineGrad = fctx.createLinearGradient(divX - 4, 0, divX + 4, 0);
  lineGrad.addColorStop(0, 'rgba(20,80,10,0)');
  lineGrad.addColorStop(0.5, `rgba(40,180,20,${0.15 + Math.sin(fPhase) * 0.08})`);
  lineGrad.addColorStop(1, 'rgba(20,80,10,0)');
  fctx.fillStyle = lineGrad; fctx.fillRect(divX - 6, 0, 12, H);

  // Stars / sky
  for (let i = 0; i < 80; i++) {
    const sx2 = (Math.sin(i * 0.73 + 1.2) * 0.5 + 0.5) * W;
    const sy2 = (Math.cos(i * 1.21 + 0.8) * 0.5 + 0.5) * H * 0.5;
    const bright = Math.sin(fPhase * 0.5 + i * 0.93) * 0.3 + 0.5;
    const col = sx2 < divX ? `rgba(200,140,80,${bright * 0.3})` : `rgba(200,255,180,${bright * 0.35})`;
    fctx.fillStyle = col;
    fctx.beginPath(); fctx.arc(sx2, sy2, 0.8, 0, Math.PI * 2); fctx.fill();
  }

  fPhase += 0.018;
  // Restoration line slowly advances during load (visual only)
  if (restoreProgress < 0.62) restoreProgress += 0.0003;

  requestAnimationFrame(drawForestBackground);
}

drawForestBackground();

// ── Fireflies ─────────────────────────────────────────────────────────────────

const ffc  = document.getElementById('fireflies') as HTMLCanvasElement;
const ffctx = ffc.getContext('2d')!;
const FIREFLIES = Array.from({ length: 40 }, (_, i) => ({
  x:  (Math.sin(i * 0.73) * 0.5 + 0.5),
  y:  0.4 + (Math.cos(i * 1.1) * 0.5 + 0.5) * 0.5,
  vx: (Math.sin(i * 2.3) - 0.5) * 0.0004,
  vy: (Math.cos(i * 1.7) - 0.5) * 0.0003,
  phase: i * 0.8,
  forest: i % 2 === 1,
}));
let ffPhase = 0;

function drawFireflies() {
  ffc.width  = window.innerWidth;
  ffc.height = window.innerHeight;
  ffctx.clearRect(0, 0, ffc.width, ffc.height);
  const divX = ffc.width * restoreProgress;
  for (const ff of FIREFLIES) {
    ff.x += ff.vx + Math.sin(ffPhase * 0.3 + ff.phase) * 0.0002;
    ff.y += ff.vy + Math.cos(ffPhase * 0.2 + ff.phase) * 0.0002;
    if (ff.x < 0) ff.x = 1; if (ff.x > 1) ff.x = 0;
    if (ff.y < 0.35) ff.y = 0.85; if (ff.y > 0.9) ff.y = 0.4;
    const sx = ff.x * ffc.width;
    const sy = ff.y * ffc.height;
    // Only render right-side fireflies in forest area, left-side in wasteland
    if (ff.forest && sx < divX) continue;
    if (!ff.forest && sx > divX) continue;
    const blink = Math.sin(ffPhase * 2 + ff.phase * 3) * 0.5 + 0.5;
    if (blink < 0.3) continue;
    const col = ff.forest ? `rgba(120,255,60,${blink * 0.7})` : `rgba(255,120,40,${blink * 0.25})`;
    const glowR = ff.forest ? 8 : 5;
    const grad = ffctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    grad.addColorStop(0, ff.forest ? `rgba(180,255,100,${blink * 0.9})` : `rgba(255,180,60,${blink * 0.4})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ffctx.fillStyle = grad;
    ffctx.beginPath(); ffctx.arc(sx, sy, glowR, 0, Math.PI * 2); ffctx.fill();
    ffctx.fillStyle = col;
    ffctx.beginPath(); ffctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ffctx.fill();
  }
  ffPhase += 0.025;
  requestAnimationFrame(drawFireflies);
}
drawFireflies();

// ── Forest Guardian figure ────────────────────────────────────────────────────

const gc  = document.getElementById('guardian-canvas') as HTMLCanvasElement;
const gctx = gc.getContext('2d')!;
let gPhase = 0;

function drawGuardian() {
  gctx.clearRect(0, 0, gc.width, gc.height);
  const cx = gc.width / 2, cy = gc.height / 2 + 8;
  const S = 3;
  const bob = Math.sin(gPhase * 1.2) * S;
  const breathe = Math.sin(gPhase * 0.8) * 0.5;

  // Shadow
  gctx.fillStyle = 'rgba(0,20,0,0.35)';
  gctx.beginPath(); gctx.ellipse(cx, cy + 15 * S, 7 * S, 2.5 * S, 0, 0, Math.PI * 2); gctx.fill();

  // Cloak — forest green, mossy
  gctx.fillStyle = '#183818';
  gctx.beginPath(); gctx.ellipse(cx, cy + bob, 8 * S, 11 * S + breathe, 0, 0, Math.PI * 2); gctx.fill();
  // Cloak highlight — bark texture
  gctx.fillStyle = '#204820';
  gctx.beginPath(); gctx.ellipse(cx - S, cy - S + bob, 4 * S, 8 * S, -0.15, 0, Math.PI * 2); gctx.fill();
  // Cloak fringe (leaf-like)
  for (let i = -3; i <= 3; i++) {
    gctx.fillStyle = '#162c16';
    gctx.beginPath();
    gctx.ellipse(cx + i * 2.5 * S, cy + 10 * S + bob, 1.5 * S, 3 * S, i * 0.15, 0, Math.PI * 2);
    gctx.fill();
  }

  // Hood
  gctx.fillStyle = '#0e200e';
  gctx.beginPath(); gctx.arc(cx, cy - 9 * S + bob, 7 * S, 0, Math.PI * 2); gctx.fill();
  // Hood rim
  gctx.strokeStyle = '#284820'; gctx.lineWidth = S * 0.5;
  gctx.beginPath(); gctx.arc(cx, cy - 9 * S + bob, 7 * S, 0.2, Math.PI - 0.2); gctx.stroke();

  // Face — warm earthen skin
  gctx.fillStyle = '#a07040';
  gctx.beginPath(); gctx.ellipse(cx, cy - 8 * S + bob, 3.5 * S, 4 * S, 0, 0, Math.PI * 2); gctx.fill();

  // Eyes — bioluminescent green
  const eyeGlow = Math.sin(gPhase * 1.5) * 0.4 + 0.6;
  gctx.fillStyle = `rgba(60,220,80,${eyeGlow})`;
  gctx.beginPath(); gctx.arc(cx - 1.5 * S, cy - 9 * S + bob, 1.2 * S, 0, Math.PI * 2); gctx.fill();
  gctx.beginPath(); gctx.arc(cx + 1.5 * S, cy - 9 * S + bob, 1.2 * S, 0, Math.PI * 2); gctx.fill();
  // Eye gleam
  gctx.fillStyle = 'rgba(200,255,200,0.6)';
  gctx.beginPath(); gctx.arc(cx - 1.5 * S + 0.5 * S, cy - 9.3 * S + bob, 0.4 * S, 0, Math.PI * 2); gctx.fill();
  gctx.beginPath(); gctx.arc(cx + 1.5 * S + 0.5 * S, cy - 9.3 * S + bob, 0.4 * S, 0, Math.PI * 2); gctx.fill();

  // Staff (with leaf top)
  const staffSway = Math.sin(gPhase) * 0.04;
  gctx.save(); gctx.translate(cx + 7 * S, cy + 12 * S + bob); gctx.rotate(staffSway);
  gctx.fillStyle = '#5a3a18';
  gctx.fillRect(-1.5 * S, -22 * S, 3 * S, 22 * S);
  // Leaf on staff top
  gctx.fillStyle = '#308040';
  gctx.beginPath(); gctx.ellipse(0, -23 * S, 2.5 * S, 5 * S, 0.3, 0, Math.PI * 2); gctx.fill();
  gctx.fillStyle = '#40b858';
  gctx.beginPath(); gctx.ellipse(-1 * S, -24 * S, 1.5 * S, 3 * S, 0.3, 0, Math.PI * 2); gctx.fill();
  // Glow from leaf
  const leafPulse = Math.sin(gPhase * 2) * 0.5 + 0.5;
  gctx.fillStyle = `rgba(60,200,60,${leafPulse * 0.15})`;
  gctx.beginPath(); gctx.arc(0, -23 * S, 8 * S, 0, Math.PI * 2); gctx.fill();
  gctx.restore();

  // Seed bag at belt
  gctx.fillStyle = '#5a4028'; gctx.beginPath();
  gctx.ellipse(cx - 7 * S, cy + 3 * S + bob, 3 * S, 3.5 * S, 0.2, 0, Math.PI * 2); gctx.fill();
  gctx.fillStyle = '#7a5838';
  gctx.beginPath(); gctx.arc(cx - 7 * S, cy + 1.5 * S + bob, 2 * S, 0, Math.PI * 2); gctx.fill();

  gPhase += 0.025;
  requestAnimationFrame(drawGuardian);
}
drawGuardian();

// ── Rotating ecological facts ─────────────────────────────────────────────────

const factEl = document.getElementById('eco-fact') as HTMLDivElement;
let factIdx = Math.floor(Math.random() * ECO_FACTS.length);

function rotateFact() {
  const f = ECO_FACTS[factIdx % ECO_FACTS.length];
  factEl.innerHTML = `<strong>${f.stat}</strong> — ${f.text}`;
  factIdx++;
}
rotateFact();
setInterval(rotateFact, 6000);

// ── Login form ────────────────────────────────────────────────────────────────

const patInput  = document.getElementById('pat-input')  as HTMLInputElement;
const loginBtn  = document.getElementById('login-btn')  as HTMLButtonElement;
const errorEl   = document.getElementById('login-error') as HTMLDivElement;
const overlay   = document.getElementById('login-overlay') as HTMLDivElement;

patInput.addEventListener('input', () => {
  loginBtn.disabled = patInput.value.trim().length < 10;
  errorEl.textContent = '';
});

patInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !loginBtn.disabled) loginBtn.click();
});

loginBtn.addEventListener('click', async () => {
  const token = patInput.value.trim();
  loginBtn.disabled   = true;
  loginBtn.textContent = 'Waking the forest…';
  errorEl.textContent  = '';

  try {
    await verifyToken(token);

    loginBtn.textContent = 'Finding your island…';
    await ensureRepo(token);

    loginBtn.textContent = 'Reading the soil…';
    const { save, sha } = await loadSave(token);
    const resolvedSave: SaveState = save ?? defaultSave();

    // Restoration line completes on successful login
    restoreProgress = 1;
    loginBtn.textContent = 'The forest remembers you.';

    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 950);

    startGame(resolvedSave, sha, (s, currentSha) => writeSave(token, s, currentSha));

  } catch (err) {
    errorEl.textContent  = (err as Error).message;
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Begin Restoration';
  }
});

// Restore cached token
const cached = localStorage.getItem('faraway_token');
if (cached) {
  patInput.value = cached;
  loginBtn.disabled = false;
}

patInput.addEventListener('blur', () => {
  if (patInput.value.trim().length > 10) {
    localStorage.setItem('faraway_token', patInput.value.trim());
  }
});
