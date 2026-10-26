import { describe, expect, it } from 'vitest';
import { defaults, validateSave } from '../../src/services/storage';
import { isBindableCode, movementInput } from '../../src/services/controls';
import { direction } from '../../src/game/movement';
const bindings = defaults().bindings;
const input = (...codes: string[]) => movementInput(new Set(codes), bindings);
describe('fixed arrow movement aliases', () => {
  it('all four arrows mirror WASD without turning the view', () => {
    for (const [arrow, letter] of [['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS'], ['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']]) { expect(input(arrow)).toEqual(input(letter)); expect(input(arrow).turn).toBe(0); }
  });
  it('W plus Up does not double forward movement', () => expect(input('KeyW', 'ArrowUp').forward).toBe(1));
  it('opposing alias directions cancel', () => { expect(input('KeyW', 'ArrowDown').forward).toBe(0); expect(input('KeyD', 'ArrowLeft').right).toBe(0); });
  it('diagonal arrows preserve normalized movement speed', () => { const i = input('ArrowUp', 'ArrowRight'), vector = direction(0, i.forward, i.right); expect(Math.hypot(vector.x, vector.z)).toBeCloseTo(1); });
  it('arrows remain available after custom movement remaps', () => { const custom = { ...bindings, forward: 'KeyI', back: 'KeyK' }; expect(movementInput(new Set(['ArrowUp']), custom).forward).toBe(1); expect(movementInput(new Set(['KeyI', 'ArrowUp']), custom).forward).toBe(1); });
  it('J/L turn independently from arrow strafing and permit keyboard-only navigation', () => { expect(input('KeyJ').turn).toBe(1); expect(input('KeyL').turn).toBe(-1); expect(input('KeyJ', 'KeyL').turn).toBe(0); expect(input('ArrowLeft', 'KeyL')).toMatchObject({ right: -1, turn: -1 }); });
  it('either shift sprints with arrows', () => { expect(input('ArrowUp', 'ShiftLeft').sprint).toBe(true); expect(input('ArrowUp', 'ShiftRight').sprint).toBe(true); });
  it('held-input clearing yields no movement or turning after pause', () => { const keys = new Set(['ArrowUp', 'ArrowRight', 'KeyJ']); keys.clear(); expect(movementInput(keys, bindings)).toEqual({ forward: 0, right: 0, turn: 0, sprint: false }); });
  it('arrows/J/L/Escape are reserved; ordinary remapping still works', () => { for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyJ', 'KeyL', 'Escape']) expect(isBindableCode(code)).toBe(false); expect(isBindableCode('KeyI')).toBe(true); });
  it('legacy action bindings cannot turn an arrow into radar or inverted movement', () => {
    const s = validateSave({ settings: { bindings: { forward: 'ArrowDown', radar: 'ArrowUp', flashlight: 'KeyJ' }, muted: true }, progress: { unlocked: 3 } });
    expect(s.settings.bindings).toEqual(bindings); expect(s.settings.muted).toBe(true); expect(s.progress.unlocked).toBe(3);
  });
});
