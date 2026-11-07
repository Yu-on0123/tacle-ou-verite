/**
 * Retours sensoriels et préférences d'affichage, 100 % locaux au navigateur :
 *  - thème (auto / sombre / clair) ;
 *  - vibrations (Android : Vibration API ; iOS ne la propose pas, on ne fait rien) ;
 *  - sons synthétisés à la volée (Web Audio : aucun fichier à charger), désactivés par défaut.
 * Tout est entouré de try/catch : stockage ou audio indisponibles ne cassent jamais le jeu.
 */
import { useSyncExternalStore } from 'react';

export type Theme = 'auto' | 'dark' | 'light';
export interface Prefs {
  theme: Theme;
  sound: boolean;
  haptics: boolean;
}

const KEY = 'tov-prefs';
const DEFAULTS: Prefs = { theme: 'auto', sound: false, haptics: true };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        theme: p.theme === 'dark' || p.theme === 'light' ? p.theme : 'auto',
        sound: p.sound === true,
        haptics: p.haptics !== false,
      };
    }
  } catch {
    /* stockage indisponible */
  }
  return DEFAULTS;
}

let prefs: Prefs = load();
const listeners = new Set<() => void>();

export function applyTheme(theme: Theme = prefs.theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0a09' : '#f6f2ea');
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible */
  }
  if (patch.theme) applyTheme();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => prefs;
export const usePrefs = (): Prefs => useSyncExternalStore(subscribe, snapshot, snapshot);

/* ------------------------------------------------------------------ */
/* Vibrations                                                          */
/* ------------------------------------------------------------------ */

export const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

const PATTERNS = {
  tap: 6,
  tick: 9,
  peel: [10, 28, 18],
  seal: [26, 40, 14],
} as const;
export type Haptic = keyof typeof PATTERNS;

export function haptic(kind: Haptic): void {
  if (!canVibrate || !prefs.haptics) return;
  try {
    navigator.vibrate(PATTERNS[kind] as number | number[]);
  } catch {
    /* ignoré */
  }
}

/* ------------------------------------------------------------------ */
/* Sons synthétisés                                                    */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

export type Sound = 'peel' | 'seal' | 'tick';

export function sound(kind: Sound): void {
  if (!prefs.sound) return;
  const c = audio();
  if (!c) return;
  try {
    const t = c.currentTime;
    if (kind === 'peel') {
      // Un ruban qui se décolle : bruit filtré dont la fréquence monte, haché par de petits à-coups
      const src = c.createBufferSource();
      src.buffer = noise(c);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(4200, t + 0.32);
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      const chop = c.createGain();
      chop.gain.setValueCurveAtTime(Float32Array.from({ length: 26 }, () => 0.35 + Math.random() * 0.65), t, 0.32);
      src.connect(bp).connect(chop).connect(env).connect(c.destination);
      src.start(t);
      src.stop(t + 0.36);
    } else if (kind === 'seal') {
      // Un tampon posé : un « toc » grave et un claquement bref
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.14);
      const g = c.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.2);
      const n = c.createBufferSource();
      n.buffer = noise(c);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2200;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(hp).connect(ng).connect(c.destination);
      n.start(t);
      n.stop(t + 0.04);
    } else {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1500;
      const g = c.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.05);
    }
  } catch {
    /* ignoré */
  }
}

/** Léger retour tactile sur les éléments de jeu (un seul écouteur, aucune modification des composants). */
export function installTapFeedback(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as Element | null)?.closest?.(
        '.card:not(:disabled), .namecard, .gamebtn:not(:disabled), .btn.primary:not(:disabled), .seg button, .seal',
      );
      if (el) haptic('tap');
    },
    { passive: true },
  );
}
