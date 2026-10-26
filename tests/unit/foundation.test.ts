import { describe, expect, it } from 'vitest';
import { CELL, LEVELS, cellAt, validateLevel, walkable, worldAt } from '../../src/game/levels';
import { collides, direction, moveCircle } from '../../src/game/movement';
import { Simulation } from '../../src/game/simulation';
const level = LEVELS[0];
describe('fresh shared maze foundation', () => {
  it('has a fully connected original route with reachable objectives', () => expect(validateLevel(level)).toEqual([]));
  it('round-trips every walkable tile between the map and world', () => { for (const c of walkable(level)) expect(cellAt(worldAt(c))).toEqual(c); });
  it('normalizes diagonal input', () => expect(Math.hypot(...Object.values(direction(0, 1, 1)))).toBeCloseTo(1));
  it('moves forward toward map north', () => expect(direction(0, 1, 0)).toEqual({ x: 0, z: -1 }));
  it('blocks walls and world boundaries', () => { const p = worldAt(level.start); const moved = moveCircle(level, p, -10, 0); expect(moved.x).toBeGreaterThan(CELL); expect(collides(level, moved)).toBe(false); });
  it('does not tunnel across walls on a large movement request', () => { const p = worldAt({ x: 1, z: 16 }); const moved = moveCircle(level, p, 30, 0); expect(moved.x).toBeLessThan(2 * CELL); });
  it('pauses simulation time and movement', () => { const s = new Simulation(); s.start(); s.step(1 / 60, { forward: 1, right: 0, sprint: false, turn: 0 }); s.pause(); const state = [s.time, s.position.x, s.position.z]; s.step(1, { forward: 1, right: 0, sprint: true, turn: 1 }); expect([s.time, s.position.x, s.position.z]).toEqual(state); });
});
