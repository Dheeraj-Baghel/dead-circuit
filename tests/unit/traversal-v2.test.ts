import { describe, expect, it } from 'vitest';
import { CELL, LEVELS, cellAt, findPath, worldAt, type Cell } from '../../src/game/levels';
import { collides } from '../../src/game/movement';
import { chaseTarget, reverseHunters, stepEnemy } from '../../src/game/hunters';
import { Simulation } from '../../src/game/simulation';

// Deterministic movement-driven run, NOT teleporting pickup flags/positions.
// Capture-free for mechanics verification; not proof of human balance.
function follow(s: Simulation, target: Cell) {
  const path = findPath(s.level, cellAt(s.position), target);
  expect(path.length).toBeGreaterThan(0);
  for (const cell of path.slice(1)) {
    const goal = worldAt(cell), span = s.level.width * CELL;
    for (let n = 0; n < 200; n++) {
      let dx = goal.x - s.position.x; const dz = goal.z - s.position.z;
      if (cell.z === s.level.tunnelRow && Math.abs(dx) > span / 2) dx += dx > 0 ? -span : span;
      const remaining = Math.hypot(dx, dz); if (remaining < 1e-6) break;
      s.step(Math.min(1 / 60, remaining / 3.2), { forward: -Math.sign(dz), right: Math.sign(dx), sprint: false, turn: 0 });
      expect(collides(s.level, s.position)).toBe(false);
      s.events.splice(0);
      // Exit contact completes the game before its centre is reached.
      if (s.mode === 'won') { expect(s.remaining).toBe(0); return; }
      if (n === 199) throw new Error(`Movement stuck towards ${cell.x},${cell.z}`);
    }
  }
}
describe('movement-driven end-to-end simulation routes', () => {
  for (const l of LEVELS) it(`${l.id}: actual movement collects every mote then exits`, () => {
    const s = new Simulation(l); s.practice = true; s.start();
    for (const p of s.pickups) if (!p.collected) follow(s, cellAt(p.position));
    expect(s.remaining).toBe(0); expect(s.blackout).toBe(true); follow(s, l.exit); expect(s.mode).toBe('won');
  });
  it('mode reversal waits for the next tile centre without cutting corners', () => {
    const s = new Simulation(), e = s.enemies[0]; s.time = 20; e.position = worldAt({ x: 5, z: 3 }); e.dir = 0;
    e.route = [{ x: 5, z: 2 }]; e.position.z -= .8; const before = e.position.z;
    reverseHunters([e]); stepEnemy(e, s, 1 / 60); expect(e.position.z).toBeLessThan(before); expect(e.reversePending).toBe(true);
    for (let i = 0; i < 100; i++) { s.time += 1 / 60; stepEnemy(e, s, 1 / 60); }
    expect(e.reversePending).toBe(false); expect(collides(s.level, e.position)).toBe(false);
  });
  it('all four blackout targets ignore retreat/noise/ambush rules', () => {
    const s = new Simulation(); s.blackout = true;
    s.noises = [{ position: worldAt({ x: 1, z: 1 }), expires: 100 }];
    for (const e of s.enemies) { e.position = { ...s.position }; expect(chaseTarget(e, s)).toEqual(cellAt(s.position)); }
  });
  it('a hunter crosses the tunnel seam locally rather than sweeping the maze', () => {
    const s = new Simulation(), e = s.enemies[0], row = s.level.tunnelRow!;
    e.position = { x: .01, z: (row + .5) * CELL }; e.route = [{ x: s.level.width - 1, z: row }]; e.dir = 1;
    stepEnemy(e, s, 1 / 60); expect(e.position.x).toBeGreaterThan(s.level.width * CELL - .1);
    expect(cellAt(e.position).z).toBe(row); expect(collides(s.level, e.position)).toBe(false);
  });
});
