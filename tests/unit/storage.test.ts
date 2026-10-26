import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaults, loadSave, save, validateSave } from '../../src/services/storage';
afterEach(() => vi.unstubAllGlobals());
describe('validated local-only saves', () => {
  it('creates sensible defaults and honors reduced motion', () => { const s = validateSave(null, true); expect(s.settings.reducedMotion).toBe(true); expect(s.progress).toEqual({ unlocked: 1, best: {} }); });
  it('clamps numeric settings and rejects wrong types', () => { const s = validateSave({ settings: { volume: 99, fov: 200, sensitivity: -2, effects: 'loud', muted: 'yes' } }); expect(s.settings.volume).toBe(1); expect(s.settings.fov).toBe(115); expect(s.settings.sensitivity).toBe(.2); expect(s.settings.effects).toBe(.7); expect(s.settings.muted).toBe(false); });
  it('rejects duplicate remaps rather than disabling an action', () => { const s = validateSave({ settings: { bindings: { forward: 'KeyQ' } } }); expect(s.settings.bindings).toEqual(defaults().bindings); });
  it('keeps valid nonconflicting bindings', () => { const s = validateSave({ settings: { bindings: { forward: 'KeyI', back: 'KeyK' } } }); expect(s.settings.bindings.forward).toBe('KeyI'); expect(s.settings.bindings.back).toBe('KeyK'); });
  it('reserves Escape and camera-turn keys', () => { const s = validateSave({ settings: { bindings: { forward: 'Escape', radar: 'ArrowLeft' } } }); expect(s.settings.bindings).toEqual(defaults().bindings); });
  it('whitelists chapter record identities', () => { const s = validateSave({ progress: { unlocked: 100, best: { service: { score: 300, time: 80, captures: 1 }, unknown: { score: 900, time: 1 } } } }); expect(s.progress.unlocked).toBe(3); expect(Object.keys(s.progress.best)).toEqual(['service']); });
  it('handles corrupt JSON without overwriting it during load', () => { const set = vi.fn(); vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: set }); expect(loadSave().warning).not.toBe(''); expect(set).not.toHaveBeenCalled(); });
  it('rejects an unknown save version safely', () => { vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: 50, progress: { unlocked: 3 } }) }); const result = loadSave(); expect(result.progress.unlocked).toBe(1); expect(result.warning).not.toBe(''); });
  it('survives disabled localStorage', () => { vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } }); expect(loadSave().progress.unlocked).toBe(1); expect(save(defaults(), { unlocked: 1, best: {} })).toBe(false); });
  it('round-trips progress and settings, not an in-flight run', () => { let data = ''; vi.stubGlobal('localStorage', { getItem: () => data || null, setItem: (_k: string, v: string) => data = v }); const s = defaults(); s.muted = true; expect(save(s, { unlocked: 2, best: { service: { score: 900, time: 120, captures: 0 } } })).toBe(true); expect(loadSave().settings.muted).toBe(true); expect(loadSave().progress.unlocked).toBe(2); expect(data).not.toContain('position'); });
  it('migrates valid v1 preferences/unlocks but archives old best scores untouched', () => {
    const legacy = JSON.stringify({ version: 1, settings: { highContrast: true, bindings: { forward: 'KeyI' } }, progress: { unlocked: 3, best: { core: { score: 4000, time: 500, captures: 1 } } } });
    const store = new Map([['dead-circuit.save.v1', legacy]]);
    const set = vi.fn((k: string, v: string) => store.set(k, v));
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: set });
    const migrated = loadSave(); expect(migrated.progress.unlocked).toBe(3); expect(migrated.progress.campaignComplete).toBe(true);
    expect(migrated.progress.best).toEqual({}); expect(migrated.settings.bindings.forward).toBe('KeyI'); expect(migrated.settings.highContrast).toBe(true); expect(set).not.toHaveBeenCalled();
    save(migrated.settings, migrated.progress); expect(store.get('dead-circuit.save.v1')).toBe(legacy);
    expect(JSON.parse(store.get('dead-circuit.save.v2')!).version).toBe(2); expect(loadSave().progress.campaignComplete).toBe(true);
  });
  it('validates Night Shift records and restores them separately from campaign', () => {
    const good = validateSave({ progress: { campaignComplete: true, nightBest: { score: 90000, night: 12 } } });
    expect(good.progress.nightBest).toEqual({ score: 90000, night: 12 });
    expect(validateSave({ progress: { nightBest: { score: 'bad', night: 5 } } }).progress.nightBest).toBeUndefined();
  });
});
