// Fixed movement aliases requested for v2 final polish. Opposing aliases cancel;
// holding W + Up must not double speed. All movement remains camera-relative.
import type { Bindings } from './storage';
import type { Input } from '../game/simulation';
export const MOVE_ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
export const TURN_KEYS = ['KeyJ', 'KeyL'] as const;
export const RESERVED_CODES: readonly string[] = ['Escape', ...MOVE_ARROWS, ...TURN_KEYS];
export const isBindableCode = (code: string) => /^(Key[A-Z]|Digit[0-9]|ShiftLeft|ShiftRight|ControlLeft|Space|AltLeft)$/.test(code) && !RESERVED_CODES.includes(code);
export const gameplayCode = (code: string, bindings: Bindings) => Object.values(bindings).includes(code) || RESERVED_CODES.includes(code);
export function movementInput(keys: ReadonlySet<string>, bindings: Bindings): Input {
  const held = (binding: keyof Bindings, arrow: string) => keys.has(bindings[binding]) || keys.has(arrow);
  return {
    forward: Number(held('forward', 'ArrowUp')) - Number(held('back', 'ArrowDown')),
    right: Number(held('right', 'ArrowRight')) - Number(held('left', 'ArrowLeft')),
    sprint: keys.has(bindings.sprint) || (bindings.sprint === 'ShiftLeft' && keys.has('ShiftRight')),
    turn: Number(keys.has('KeyJ')) - Number(keys.has('KeyL')),
  };
}
export const isEditableTarget = (target: EventTarget | null) => typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && !!target.closest('input,select,textarea,[contenteditable="true"]');
