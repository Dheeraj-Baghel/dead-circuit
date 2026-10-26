import { describe, expect, it } from 'vitest';
import { LEVELS, TRAINING, cellAt, isWall, key, validateLevel, walkable, worldAt } from '../../src/game/levels';
import { Simulation, type Input } from '../../src/game/simulation';
import { findPath, stepEnemy } from '../../src/game/ai';
const idle: Input = { forward: 0, right: 0, sprint: false, turn: 0 };
describe('chapter and route regression', () => {
  for (const level of [TRAINING, ...LEVELS]) {
    it(`${level.id}: every objective reachable before any relay`, () => { expect(validateLevel(level)).toEqual([]); for (const c of walkable(level)) expect(findPath(level, level.start, c).length).toBeGreaterThan(0); });
    it(`${level.id}: controlled collection and exit complete`, () => {
      // Explicit fixture: not a human playthrough or a fairness claim.
      const s = new Simulation(level); s.start(); s.practice = true;
      for (const p of s.pickups) { s.position = { ...p.position }; s.step(1 / 60, idle); }
      expect(s.remaining).toBe(0); s.position = worldAt(level.exit); s.step(1 / 60, idle); expect(s.mode).toBe('won');
    });
    it(`${level.id}: hunters remain on permission-correct cells for 60 seconds`, () => {
      const s = new Simulation(level); s.position = worldAt(level.exit);
      for (let i = 0; i < 3600; i++) { s.time += 1 / 60; for (const e of s.enemies) { stepEnemy(e, s, 1 / 60); const c = cellAt(e.position); expect(isWall(s.level, c.x, c.z, 'hunter')).toBe(false); } }
    });
  }
  it('relay shortcut changes only the run graph and adds no objectives', () => {
    for (const l of LEVELS) {
      const s = new Simulation(l), before = [...l.grid], shortcut = l.shortcuts![0]; s.start(); s.position = worldAt(shortcut.relay);
      for (const c of shortcut.cells) expect(isWall(s.level, c.x, c.z)).toBe(true);
      const total = s.total; s.interact(); for (const c of shortcut.cells) expect(isWall(s.level, c.x, c.z)).toBe(false);
      expect(l.grid).toEqual(before); expect(validateLevel(s.level)).toEqual([]); expect(s.relays.has(key(shortcut.relay))).toBe(true);
      s.interact(); expect(s.total).toBe(total); expect(s.score).toBe(150);
    }
  });
  it('training is capture-free and has a single demonstration hunter', () => { const s = new Simulation(TRAINING); expect(s.practice).toBe(true); expect(s.enemies).toHaveLength(1); });
});
