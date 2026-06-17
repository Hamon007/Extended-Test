/**
 * AudioService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Prozedurale Sound-Engine (Web Audio API).
 * KEINE Asset-Dateien — alle Effekte werden synthetisiert.
 * Das hält die PWA klein und sorgt trotzdem für Combat-Wucht.
 *
 * Browser verlangen eine User-Geste, bevor Audio laufen darf:
 * unlock() wird beim ersten Tap aufgerufen (siehe App.tsx).
 * ─────────────────────────────────────────────────────────────
 */

const MUTE_KEY = 'ci_sound_muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch { /* localStorage evtl. nicht verfügbar */ }

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  // iOS/Chrome: Kontext kann suspendiert starten
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ── Synth-Bausteine ───────────────────────────────────────────

/** Ein Ton mit ADSR-artiger Hüllkurve. */
function tone(opts: {
  freq:    number;
  endFreq?: number;
  dur:     number;
  type?:   OscillatorType;
  gain?:   number;
  attack?: number;
  delay?:  number;
}): void {
  const ac = ensureContext();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);

  const osc = ac.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq && opts.endFreq !== opts.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + opts.dur);
  }

  const g = ac.createGain();
  const peak    = opts.gain ?? 0.3;
  const attack  = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** Rausch-Burst durch ein Filter — für Einschläge/Impacts. */
function noise(opts: {
  dur:      number;
  gain?:    number;
  type?:    BiquadFilterType;
  freq?:    number;
  endFreq?: number;
  delay?:   number;
}): void {
  const ac = ensureContext();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);

  const len = Math.floor(ac.sampleRate * opts.dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;

  const filt = ac.createBiquadFilter();
  filt.type = opts.type ?? 'lowpass';
  filt.frequency.setValueAtTime(opts.freq ?? 1200, t0);
  if (opts.endFreq) filt.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + opts.dur);

  const g = ac.createGain();
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

// ── Öffentliche SFX ───────────────────────────────────────────

export const AudioService = {
  /** Beim ersten User-Tap aufrufen, um Audio freizuschalten. */
  unlock(): void {
    ensureContext();
  },

  isMuted(): boolean { return muted; },

  setMuted(v: boolean): void {
    muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    if (master) master.gain.value = v ? 0 : 0.5;
  },

  toggleMute(): boolean {
    AudioService.setMuted(!muted);
    return muted;
  },

  /** Sanftes Haptik-Feedback (nur Mobile). */
  vibrate(pattern: number | number[]): void {
    if (muted) return;
    try { navigator.vibrate?.(pattern); } catch { /* nicht unterstützt */ }
  },

  // ── UI ──
  tap(): void {
    if (muted) return;
    tone({ freq: 520, endFreq: 660, dur: 0.05, type: 'triangle', gain: 0.12 });
  },

  /** Rad/Slot-Tick — kurzer perkussiver Klick. */
  tick(): void {
    if (muted) return;
    noise({ dur: 0.04, gain: 0.10, type: 'bandpass', freq: 900, endFreq: 400 });
    tone({ freq: 660, endFreq: 330, dur: 0.03, type: 'square', gain: 0.07 });
  },

  /** Fanfare für großen Gewinn — kurze aufsteigende Trompete. */
  jackpot(): void {
    if (muted) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: 'sawtooth', gain: 0.12, attack: 0.04, delay: i * 0.08 }));
    noise({ dur: 0.6, gain: 0.16, type: 'highpass', freq: 600, endFreq: 5000 });
    tone({ freq: 110, endFreq: 220, dur: 0.7, type: 'sine', gain: 0.25, delay: 0.1 });
  },

  // ── Combat ──
  /** Karte wird ausgespielt — leichter Saiten-Anschlag. */
  cardPlay(): void {
    if (muted) return;
    tone({ freq: 440, endFreq: 600, dur: 0.09, type: 'triangle', gain: 0.16 });
  },

  /** Treffer am Gegner. intensity 0..1 skaliert Wucht. */
  hit(intensity = 0.5): void {
    if (muted) return;
    const i = Math.max(0.2, Math.min(1, intensity));
    noise({ dur: 0.12, gain: 0.18 + i * 0.22, type: 'lowpass', freq: 1400 + i * 1800, endFreq: 200 });
    tone({ freq: 150, endFreq: 60, dur: 0.14, type: 'sine', gain: 0.2 + i * 0.25 });
  },

  /** Kritischer / erwachter Treffer — heller metallischer Schlag. */
  crit(): void {
    if (muted) return;
    noise({ dur: 0.18, gain: 0.4, type: 'highpass', freq: 2600 });
    tone({ freq: 880,  dur: 0.16, type: 'square', gain: 0.18 });
    tone({ freq: 1320, dur: 0.2,  type: 'square', gain: 0.14, delay: 0.02 });
    tone({ freq: 180,  endFreq: 70, dur: 0.22, type: 'sine', gain: 0.3 });
  },

  /** Combo-Stufe steigt — Tonhöhe klettert mit count. */
  combo(count: number): void {
    if (muted) return;
    const base = 523; // C5
    const freq = base * Math.pow(2, Math.min(5, count) / 12);
    tone({ freq, endFreq: freq * 1.5, dur: 0.1, type: 'triangle', gain: 0.13 });
  },

  /** Combo gebrochen — dumpfer absteigender Ton. */
  comboBreak(): void {
    if (muted) return;
    tone({ freq: 300, endFreq: 90, dur: 0.3, type: 'sawtooth', gain: 0.16 });
    noise({ dur: 0.18, gain: 0.1, type: 'lowpass', freq: 500, endFreq: 120 });
  },

  /** Synergie ausgelöst — funkelndes Arpeggio. */
  synergy(): void {
    if (muted) return;
    [659, 880, 1175].forEach((f, i) =>
      tone({ freq: f, dur: 0.14, type: 'sine', gain: 0.14, delay: i * 0.05 }));
  },

  /** Super-Angriff — dramatischer Akkord-Schwall. */
  super(): void {
    if (muted) return;
    [392, 494, 587, 784].forEach((f, i) =>
      tone({ freq: f, dur: 0.7, type: 'sawtooth', gain: 0.1, attack: 0.08, delay: i * 0.015 }));
    noise({ dur: 0.5, gain: 0.18, type: 'highpass', freq: 400, endFreq: 4000 });
    tone({ freq: 110, endFreq: 55, dur: 0.6, type: 'sine', gain: 0.3, delay: 0.1 });
  },

  /** Karte erwacht (True Awakening im Kampf). */
  awaken(): void {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.12, attack: 0.05, delay: i * 0.06 }));
  },

  /** Verteidigungs-Haltung — metallischer Schild-Klang. */
  guard(): void {
    if (muted) return;
    tone({ freq: 330, endFreq: 220, dur: 0.18, type: 'square', gain: 0.14 });
    noise({ dur: 0.14, gain: 0.12, type: 'bandpass', freq: 1200 });
    tone({ freq: 660, dur: 0.12, type: 'sine', gain: 0.1, delay: 0.04 });
  },

  /** Spieler nimmt Schaden — dunkler Einschlag. */
  enemyHit(): void {
    if (muted) return;
    noise({ dur: 0.16, gain: 0.22, type: 'lowpass', freq: 600, endFreq: 120 });
    tone({ freq: 110, endFreq: 50, dur: 0.18, type: 'sine', gain: 0.22 });
  },

  // ── Meta ──
  victory(): void {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.45, type: 'triangle', gain: 0.16, delay: i * 0.12 }));
  },

  defeat(): void {
    if (muted) return;
    [440, 392, 349, 262].forEach((f, i) =>
      tone({ freq: f, dur: 0.5, type: 'sine', gain: 0.16, delay: i * 0.16 }));
  },

  /** Belohnung / Münze — kurzer heller Doppelton. */
  reward(): void {
    if (muted) return;
    tone({ freq: 988,  dur: 0.1, type: 'square', gain: 0.12 });
    tone({ freq: 1319, dur: 0.14, type: 'square', gain: 0.12, delay: 0.08 });
  },

  /** Gacha-Reveal — Glanz, Intensität nach Seltenheit (0..1). */
  reveal(intensity = 0.5): void {
    if (muted) return;
    const i = Math.max(0.2, Math.min(1, intensity));
    [659, 988, 1319].forEach((f, idx) =>
      tone({ freq: f, dur: 0.25 + i * 0.3, type: 'sine', gain: 0.1 + i * 0.08, delay: idx * 0.07 }));
    if (i > 0.7) noise({ dur: 0.4, gain: 0.14, type: 'highpass', freq: 3000 });
  },
};
