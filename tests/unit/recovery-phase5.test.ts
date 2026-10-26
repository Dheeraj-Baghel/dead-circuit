import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaults, save, loadSave } from '../../src/services/storage';
afterEach(() => vi.unstubAllGlobals());
const key = 'dead-circuit.save.v2', recovery = 'dead-circuit.save.recovery';
function storage(entries: [string, string][]) {
  const values = new Map(entries), writes: string[] = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { writes.push(k); values.set(k, v); } });
  return { values, writes };
}
describe('save replacement preserves recovery evidence', () => {
  it('backs up corrupt bytes before writing a replacement after an explicit preference change', () => {
    const raw = '{corrupt original', { values, writes } = storage([[key, raw]]);
    expect(loadSave().warning).not.toBe(''); expect(writes).toEqual([]);
    expect(save({ ...defaults(), muted: true }, { unlocked: 1, best: {} })).toBe(true);
    expect(writes).toEqual([recovery, key]); expect(values.get(recovery)).toBe(raw); expect(loadSave().settings.muted).toBe(true);
  });
  it('a future-version payload is retained byte-for-byte, not coerced into v2', () => {
    const raw = JSON.stringify({ version: 99, future: { progress: 'preserve this' } }), { values } = storage([[key, raw]]);
    expect(save(defaults(), { unlocked: 1, best: {} })).toBe(true); expect(values.get(recovery)).toBe(raw);
  });
  it('will not overwrite an earlier distinct recovery snapshot', () => {
    const { values, writes } = storage([[key, '{second corrupt'], [recovery, '{first corrupt']]);
    expect(save(defaults(), { unlocked: 1, best: {} })).toBe(false); expect(values.get(key)).toBe('{second corrupt'); expect(values.get(recovery)).toBe('{first corrupt'); expect(writes).toEqual([]);
  });
  it('does not create recovery snapshots for normal current-version saves', () => {
    const { writes } = storage([[key, JSON.stringify({ version: 2, progress: { unlocked: 2 } })]]);
    expect(save(defaults(), { unlocked: 2, best: {} })).toBe(true); expect(writes).toEqual([key]);
  });
});
