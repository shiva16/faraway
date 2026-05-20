import { verifyToken, ensureRepo, loadSave, writeSave } from './github';
import { startGame } from './game';
import { defaultSave } from './types';
import type { SaveState } from './types';

// ── Pixel wanderer animation on login screen ──────────────────────────────────

const wc = document.getElementById('wanderer-canvas') as HTMLCanvasElement;
const wctx = wc.getContext('2d')!;
const S = 3;
let wPhase = 0;

function drawLoginWanderer() {
  wctx.clearRect(0, 0, wc.width, wc.height);
  const cx = wc.width / 2, cy = wc.height / 2 + 4;
  const bob = Math.sin(wPhase) * S;

  // Shadow
  wctx.fillStyle = 'rgba(0,0,0,0.3)';
  wctx.beginPath();
  wctx.ellipse(cx, cy + 14 * S, 6 * S, 2 * S, 0, 0, Math.PI * 2);
  wctx.fill();

  // Cloak
  wctx.fillStyle = '#3d2e1a';
  wctx.beginPath();
  wctx.ellipse(cx, cy + bob, 7 * S, 10 * S, 0, 0, Math.PI * 2);
  wctx.fill();

  // Cloak highlight
  wctx.fillStyle = '#5a4228';
  wctx.beginPath();
  wctx.ellipse(cx - S, cy - 2 * S + bob, 4 * S, 7 * S, -0.2, 0, Math.PI * 2);
  wctx.fill();

  // Hood
  wctx.fillStyle = '#1e150a';
  wctx.beginPath();
  wctx.arc(cx, cy - 8 * S + bob, 7 * S, 0, Math.PI * 2);
  wctx.fill();

  // Face
  wctx.fillStyle = '#c8905a';
  wctx.beginPath();
  wctx.ellipse(cx, cy - 7 * S + bob, 3 * S, 3.5 * S, 0, 0, Math.PI * 2);
  wctx.fill();

  // Eyes
  wctx.fillStyle = '#1a0800';
  wctx.fillRect(cx - 2 * S, cy - 8 * S + bob, S, S);
  wctx.fillRect(cx + S, cy - 8 * S + bob, S, S);

  wPhase += 0.04;
  requestAnimationFrame(drawLoginWanderer);
}

drawLoginWanderer();

// ── Pixel stars on login ──────────────────────────────────────────────────────

const sc = document.getElementById('stars') as HTMLCanvasElement;
const sctx = sc.getContext('2d')!;
const loginStars = Array.from({ length: 120 }, (_, i) => ({
  x: (Math.sin(i * 0.73 + 1.2) * 0.5 + 0.5) * window.innerWidth,
  y: (Math.cos(i * 1.21 + 0.8) * 0.5 + 0.5) * window.innerHeight,
  r: 0.6 + (Math.sin(i * 2.3) * 0.5 + 0.5) * 1.5,
  t: Math.sin(i * 0.93) * 3,
}));
let starPhase = 0;

function drawLoginStars() {
  sc.width  = window.innerWidth;
  sc.height = window.innerHeight;
  sctx.clearRect(0, 0, sc.width, sc.height);
  for (const s of loginStars) {
    const tw = Math.sin(starPhase + s.t) * 0.3 + 0.7;
    sctx.fillStyle = `rgba(255,250,210,${tw * 0.7})`;
    sctx.beginPath();
    sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    sctx.fill();
  }
  starPhase += 0.015;
  requestAnimationFrame(drawLoginStars);
}
drawLoginStars();

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
  loginBtn.textContent = 'Rowing…';
  errorEl.textContent  = '';

  try {
    // Validate token
    await verifyToken(token);

    loginBtn.textContent = 'Finding the island…';
    await ensureRepo(token);

    loginBtn.textContent = 'Loading your footsteps…';
    const { save, sha } = await loadSave(token);
    const resolvedSave: SaveState = save ?? defaultSave();

    // Fade out login
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 850);

    // Start game
    startGame(resolvedSave, sha, (s, currentSha) => writeSave(token, s, currentSha));

  } catch (err) {
    errorEl.textContent  = (err as Error).message;
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Set Sail';
  }
});

// Check localStorage for cached token (convenience, no auto-login)
const cached = localStorage.getItem('faraway_token');
if (cached) {
  patInput.value = cached;
  loginBtn.disabled = false;
}

// Save token on successful login attempt (cached for next visit)
patInput.addEventListener('blur', () => {
  if (patInput.value.trim().length > 10) {
    localStorage.setItem('faraway_token', patInput.value.trim());
  }
});
