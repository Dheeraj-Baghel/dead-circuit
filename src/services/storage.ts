import { isBindableCode } from './controls';
export type Bindings = { forward: string; back: string; left: string; right: string; sprint: string; interact: string; flashlight: string; radar: string };
export type Settings = { volume: number; music: number; ambience: number; effects: number; heartbeat: boolean; muted: boolean; sensitivity: number; invert: boolean; fov: number; cameraMode: 'third' | 'first'; reducedMotion: boolean; reducedScares: boolean; captions: boolean; highContrast: boolean; mapScale: number; mapVisibility: 'confirmed' | 'arcade'; mapOrientation: 'north' | 'heading'; quality: 'standard' | 'low'; difficulty: 'standard' | 'relaxed'; practice: boolean; bindings: Bindings };
export type Progress = { unlocked: number; best: Record<string, { score: number; time: number; captures: number }>; campaignComplete?: boolean; nightBest?: { score: number; night: number } };
export const defaults = (reducedMotion = false): Settings => ({ volume: .55, music: .45, ambience: .45, effects: .7, heartbeat: true, muted: false, sensitivity: 1, invert: false, fov: 95,
  cameraMode: 'third', reducedMotion, reducedScares: false, captions: true, highContrast: false, mapScale: 1, mapVisibility: 'confirmed', mapOrientation: 'north', quality: 'standard', difficulty: 'standard', practice: false,
  bindings: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', interact: 'KeyE', flashlight: 'KeyF', radar: 'KeyQ' } });
const SAVE_KEY = 'dead-circuit.save.v2';
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function validateSave(value: unknown, reduced = false): { settings: Settings; progress: Progress } {
  const root = object(value), s = object(root.settings), p = object(root.progress), settings = defaults(reduced), progress: Progress = { unlocked: 1, best: {} };
  for (const key of ['muted', 'invert', 'reducedMotion', 'reducedScares', 'captions', 'highContrast', 'practice', 'heartbeat'] as const) if (typeof s[key] === 'boolean') settings[key] = s[key];
  for (const [key, min, max] of [['volume', 0, 1], ['music', 0, 1], ['effects', 0, 1], ['sensitivity', .2, 3], ['fov', 75, 115], ['mapScale', .85, 1.35]] as const) settings[key] = number(s[key], settings[key], min, max);
  // Older music field controlled ambience. Preserve that level when adding
  // the independent ambience bus; no progress/schema reset is needed.
  settings.ambience = number(s.ambience, number(s.music, settings.ambience, 0, 1), 0, 1);
  if (s.quality === 'low') settings.quality = 'low';
  if (s.difficulty === 'relaxed') settings.difficulty = 'relaxed';
  if (s.cameraMode === 'first') settings.cameraMode = 'first';
  // Optional v2 presentation fields: older saves retain the reliable defaults.
  if (s.mapVisibility === 'arcade') settings.mapVisibility = 'arcade';
  if (s.mapOrientation === 'heading') settings.mapOrientation = 'heading';
  const bindings = object(s.bindings), codes = new Set<string>();
  const candidate = { ...settings.bindings };
  for (const key of Object.keys(candidate) as (keyof Bindings)[]) {
    const val = bindings[key];
    // Newly fixed arrows and J/L cannot also fire saved actions. Repair only
    // conflicting bindings (or default the set if duplicates result), not saves.
    if (typeof val === 'string' && isBindableCode(val)) candidate[key] = val;
    if (codes.has(candidate[key])) { codes.clear(); break; } codes.add(candidate[key]);
  }
  if (codes.size === Object.keys(candidate).length) settings.bindings = candidate;
  progress.unlocked = Math.round(number(p.unlocked, 1, 1, 3));
  if (p.campaignComplete === true) progress.campaignComplete = true;
  const nightBest = object(p.nightBest);
  if (typeof nightBest.score === 'number' && typeof nightBest.night === 'number') progress.nightBest = { score: Math.floor(number(nightBest.score, 0, 0, 100000000)), night: Math.floor(number(nightBest.night, 1, 1, 100000)) };
  for (const [id, raw] of Object.entries(object(p.best))) {
    const b = object(raw); if (!['service', 'drainworks', 'core'].includes(id)) continue;
    if (typeof b.score !== 'number' || typeof b.time !== 'number') continue;
    progress.best[id] = { score: Math.floor(number(b.score, 0, 0, 1000000)), time: number(b.time, 0, 0, 36000), captures: Math.floor(number(b.captures, 0, 0, 4)) };
  }
  return { settings, progress };
}
export function loadSave(reduced = false) {
  try {
    const raw = localStorage.getItem(SAVE_KEY), legacy = raw ? null : localStorage.getItem('dead-circuit.save.v1');
    const parsed = raw || legacy ? JSON.parse((raw || legacy)!) : null;
    if ((raw && object(parsed).version !== 2) || (legacy && object(parsed).version !== 1)) throw new Error('Unsupported save version');
    // The old value is never overwritten. Migrate bindings/preferences/unlocks,
    // but don't compare records earned on entirely different v1 maze layouts.
    if (legacy) {
      const root = object(parsed), migrated = validateSave(parsed, reduced);
      root.progress = { ...migrated.progress, campaignComplete: !!migrated.progress.best.core, best: {} };
    }
    return { ...validateSave(parsed, reduced), warning: '' };
  }
  catch { return { ...validateSave(null, reduced), warning: 'Saved data is unavailable. The original is protected; a recovery copy is required before replacement.' }; }
}
export function save(settings: Settings, progress: Progress): boolean {
  try {
    const previous = localStorage.getItem(SAVE_KEY);
    let needsRecovery = false;
    if (previous) { try { needsRecovery = object(JSON.parse(previous)).version !== 2; } catch { needsRecovery = true; } }
    if (needsRecovery && previous) {
      const recoveryKey = 'dead-circuit.save.recovery', existing = localStorage.getItem(recoveryKey);
      // Never destroy either an unreadable/future save or an earlier recovery
      // snapshot merely because the player changes a display preference.
      if (existing && existing !== previous) return false;
      if (!existing) localStorage.setItem(recoveryKey, previous);
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, ...validateSave({ settings, progress }) })); return true;
  } catch { return false; }
}
