// ── Folk Music Engine ─────────────────────────────────────────────────────────
// Procedural synthesis of 12 traditional folk melodies.
// Soft background layer — won't mask game sound effects.

let _ctx:       AudioContext | null = null;
let masterGain: GainNode     | null = null;
let _muted      = false;
let trackIdx    = 0;
let noteIdx     = 0;
let nextBeat    = 0;     // AudioContext time for the next note
let schedTimer  = 0;
let droneNodes: OscillatorNode[] = [];
let trackChangeCb: ((name: string) => void) | null = null;

const LOOKAHEAD = 0.35;   // seconds to schedule ahead
const SCHED_MS  = 80;     // scheduler poll interval
const MASTER_V  = 0.12;   // master volume (well below game SFX)

// ── Note frequency helper ─────────────────────────────────────────────────────
const SEMIS: Record<string, number> = {
  C:0, D:2, E:4, F:5, G:7, A:9, B:11,
};
function hz(name: string): number {
  if (name === 'R') return 0;
  const sharp = name.includes('#') ? 1 : name.includes('b') ? -1 : 0;
  const letter = name[0];
  const oct = parseInt(name.replace(/[^0-9]/g, '')) - 4;
  return 440 * Math.pow(2, (SEMIS[letter] + sharp - 9 + oct * 12) / 12);
}

// ── Track definitions ─────────────────────────────────────────────────────────
// Each note: [name, beats]  — 'R' = rest
type NoteEntry = [string, number];

interface Track {
  name:       string;
  bpm:        number;
  instrument: 'flute' | 'dulcimer' | 'harp';
  drone:      [string, string];   // tonic + fifth for sustained backing
  melody:     NoteEntry[];
}

const TRACKS: Track[] = [
  {
    name: 'Scarborough Fair', bpm: 70, instrument: 'flute', drone: ['E3','B3'],
    melody: [
      ['E4',2],['D4',1],['A3',3],['G3',1],['A3',1],['B3',1],
      ['C4',1],['D4',2],['E4',3],['B3',2],['G3',1],['A3',3],['R',1],
      ['A3',1],['B3',1],['C4',1],['D4',2],['D4',1],
      ['G4',3],['R',1],['E4',2],['D4',1],['E4',3],['R',2],
    ],
  },
  {
    name: 'Greensleeves', bpm: 64, instrument: 'dulcimer', drone: ['A2','E3'],
    melody: [
      ['A3',2],['C4',3],['D4',1],['E4',3],['F4',1],
      ['E4',2],['D4',3],['B3',1],['G3',2],['B3',1],
      ['C4',3],['A3',3],
      ['A3',2],['E4',3],['G4',1],['F4',3],['E4',1],
      ['D4',3],['C4',1],['B3',2],['G3',2],['B3',1],
      ['C4',3],['A3',3],['R',2],
    ],
  },
  {
    name: 'Danny Boy', bpm: 58, instrument: 'flute', drone: ['G3','D4'],
    melody: [
      ['D4',1],['G4',2],['G4',1],['A4',1],['G4',1],
      ['G4',2],['B4',2],['D5',2],['D5',1],['B4',1],
      ['G4',1],['D5',1],['B4',2],['A4',3],['R',1],
      ['G4',2],['D5',2],['E5',2],['D5',1],
      ['B4',2],['G4',2],['A4',2],['G4',3],['R',2],
    ],
  },
  {
    name: 'The Water Is Wide', bpm: 58, instrument: 'harp', drone: ['G3','D4'],
    melody: [
      ['D4',2],['G4',2],['A4',1],['G4',3],
      ['B4',3],['D5',2],['B4',2],['G4',3],
      ['A4',1],['G4',2],['D4',3],
      ['G4',2],['A4',2],['B4',3],['G4',2],['R',1],
    ],
  },
  {
    name: 'Shenandoah', bpm: 50, instrument: 'flute', drone: ['F3','C4'],
    melody: [
      ['F4',2],['A4',2],['G4',1],['F4',3],
      ['G4',1],['A4',3],['G4',2],['F4',2],
      ['D4',3],['F4',1],['G4',2],['A4',2],
      ['G4',2],['F4',2],['C4',3],['R',2],
    ],
  },
  {
    name: 'Skye Boat Song', bpm: 74, instrument: 'dulcimer', drone: ['G3','D4'],
    melody: [
      ['G4',2],['E5',3],['D5',1],['C5',2],
      ['D5',1],['E5',3],['D5',1],['B4',2],
      ['G4',2],['D5',3],['E5',1],['G5',2],
      ['E5',2],['D5',3],['R',2],
    ],
  },
  {
    name: 'She Moved Through the Fair', bpm: 60, instrument: 'flute', drone: ['D3','A3'],
    melody: [
      ['D4',2],['F4',2],['G4',2],['A4',2],
      ['G4',2],['F4',2],['D4',3],
      ['E4',1],['D4',2],['F4',2],['G4',2],
      ['A4',2],['G4',2],['F4',3],['D4',3],['R',1],
    ],
  },
  {
    name: 'The Foggy Dew', bpm: 70, instrument: 'harp', drone: ['D3','A3'],
    melody: [
      ['D4',2],['F4',2],['G4',2],['A4',2],
      ['G4',2],['F4',2],['D4',3],
      ['A3',1],['D4',2],['G4',2],['F4',2],
      ['E4',2],['D4',3],['R',2],
    ],
  },
  {
    name: 'Wildwood Flower', bpm: 98, instrument: 'dulcimer', drone: ['G3','D4'],
    melody: [
      ['G4',1],['G4',1],['B4',2],['D5',2],
      ['D5',1],['B4',1],['G4',1],['E4',2],
      ['G4',2],['G4',1],['B4',1],['D5',2],
      ['B4',2],['G4',3],['R',1],
    ],
  },
  {
    name: 'Loch Lomond', bpm: 74, instrument: 'harp', drone: ['G3','D4'],
    melody: [
      ['G4',2],['B4',2],['D5',3],['D5',1],
      ['B4',2],['A4',2],['G4',3],
      ['D4',2],['G4',2],['B4',3],['A4',1],
      ['G4',2],['A4',2],['D5',3],['R',2],
    ],
  },
  {
    name: 'Black Is the Color', bpm: 58, instrument: 'flute', drone: ['D3','A3'],
    melody: [
      ['D4',2],['F4',2],['G4',2],['A4',2],
      ['G4',2],['F4',2],['D4',2],
      ['E4',2],['F4',2],['G4',2],['A4',3],
      ['G4',1],['F4',2],['D4',3],['R',2],
    ],
  },
  {
    name: 'The Parting Glass', bpm: 82, instrument: 'dulcimer', drone: ['G3','D4'],
    melody: [
      ['G4',2],['A4',2],['B4',2],['D5',2],
      ['B4',2],['A4',2],['G4',3],
      ['G4',1],['A4',2],['D5',2],['B4',2],
      ['A4',2],['G4',3],['R',2],
    ],
  },
];

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startMusic(ctx: AudioContext): void {
  if (_ctx) return;
  _ctx = ctx;
  masterGain = _ctx.createGain();
  masterGain.gain.value = MASTER_V;
  masterGain.connect(_ctx.destination);

  // Random start track
  trackIdx = Math.floor(Math.random() * TRACKS.length);
  noteIdx  = 0;
  nextBeat = _ctx.currentTime + 0.5;

  _startDrone();
  _schedule();
}

function _schedule(): void {
  if (!_ctx || !masterGain) return;
  const track   = TRACKS[trackIdx];
  const beatSec = 60 / track.bpm;

  while (nextBeat < _ctx.currentTime + LOOKAHEAD) {
    const [name, beats] = track.melody[noteIdx];
    const dur = beats * beatSec;
    if (name !== 'R' && !_muted) {
      _playNote(hz(name), nextBeat, dur * 0.88, track.instrument);
    }
    nextBeat += dur;
    noteIdx++;

    if (noteIdx >= track.melody.length) {
      noteIdx = 0;
      // ~25% chance to move to next track after a full loop
      if (Math.random() < 0.25) {
        _stopDrone();
        trackIdx = (trackIdx + 1) % TRACKS.length;
        _startDrone();
        trackChangeCb?.(TRACKS[trackIdx].name);
      }
    }
  }

  schedTimer = window.setTimeout(_schedule, SCHED_MS);
}

// ── Drone backing (tonic + fifth) ─────────────────────────────────────────────

function _startDrone(): void {
  if (!_ctx || !masterGain) return;
  const [t, f] = TRACKS[trackIdx].drone;
  const dg = _ctx.createGain();
  dg.gain.value = 0.038;
  dg.connect(masterGain);
  for (const note of [t, f]) {
    for (const detune of [0, 3]) {          // slight chorus
      const o = _ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(note);
      o.detune.value = detune;
      o.connect(dg);
      o.start();
      droneNodes.push(o);
    }
  }
}

function _stopDrone(): void {
  const when = _ctx ? _ctx.currentTime + 1.5 : 0;
  for (const o of droneNodes) { try { o.stop(when); } catch { /* ignore */ } }
  droneNodes = [];
}

// ── Note synthesis ────────────────────────────────────────────────────────────

function _playNote(
  freq: number, startTime: number, dur: number,
  instrument: 'flute' | 'dulcimer' | 'harp',
): void {
  if (!_ctx || !masterGain) return;

  const ng = _ctx.createGain();
  ng.connect(masterGain);
  const stop = startTime + dur + 0.06;

  if (instrument === 'dulcimer') {
    // Plucked string: instant attack, exponential decay
    const o = _ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    // Second harmonic for brightness
    const o2 = _ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const hg = _ctx.createGain(); hg.gain.value = 0.25;
    o2.connect(hg); hg.connect(ng);
    ng.gain.setValueAtTime(0.001, startTime);
    ng.gain.exponentialRampToValueAtTime(1.0, startTime + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    o.connect(ng); o2.connect(hg);
    o.start(startTime); o.stop(stop);
    o2.start(startTime); o2.stop(stop);

  } else if (instrument === 'flute') {
    // Sine with gentle attack + subtle vibrato after attack
    const o = _ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const lfo = _ctx.createOscillator();
    const lg  = _ctx.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.value = 1.8;
    lfo.connect(lg); lg.connect(o.frequency);
    const vibratoStart = startTime + 0.09;
    lfo.start(vibratoStart); lfo.stop(stop);
    ng.gain.setValueAtTime(0, startTime);
    ng.gain.linearRampToValueAtTime(0.9, startTime + 0.08);
    ng.gain.setValueAtTime(0.9, startTime + dur - 0.10);
    ng.gain.linearRampToValueAtTime(0, startTime + dur);
    o.connect(ng);
    o.start(startTime); o.stop(stop);

  } else { // harp
    // Sine + second harmonic, medium decay
    const o = _ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = _ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const hg = _ctx.createGain(); hg.gain.value = 0.28;
    o2.connect(hg); hg.connect(ng);
    ng.gain.setValueAtTime(0, startTime);
    ng.gain.linearRampToValueAtTime(1.0, startTime + 0.012);
    ng.gain.setValueAtTime(0.9, startTime + 0.05);
    ng.gain.linearRampToValueAtTime(0, startTime + dur);
    o.connect(ng);
    o.start(startTime); o.stop(stop);
    o2.start(startTime); o2.stop(startTime + dur * 0.6);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function setTrackChangeCb(fn: (name: string) => void): void {
  trackChangeCb = fn;
}

export function toggleMuteMusic(): boolean {
  _muted = !_muted;
  if (masterGain && _ctx) {
    masterGain.gain.setTargetAtTime(_muted ? 0 : MASTER_V, _ctx.currentTime, 0.4);
  }
  return _muted;
}

export function isMusicMuted(): boolean { return _muted; }

export function getCurrentTrackName(): string {
  return TRACKS[trackIdx]?.name ?? '';
}

export function stopMusic(): void {
  clearTimeout(schedTimer);
  _stopDrone();
  if (masterGain && _ctx) masterGain.gain.setTargetAtTime(0, _ctx.currentTime, 0.3);
}
