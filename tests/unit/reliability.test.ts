import { describe, expect, it } from 'vitest';
import { Simulation, type Input } from '../../src/game/simulation';
import { contactFraction } from '../../src/game/movement';
import { CELL, cellAt, worldAt } from '../../src/game/levels';
import { chaseTarget, stepEnemy } from '../../src/game/ai';
const idle: Input = { forward: 0, right: 0, sprint: false, turn: 0 };
const contact = () => { const s = new Simulation(); s.start(); s.time = 10; s.position = worldAt(s.level.spots.contact); s.enemies[0].position = { ...s.position }; s.enemies[0].state = 'chase'; s.enemies[0].route = []; return s; };
describe('contact ordering and timing regression', () => {
  it('earliest circle contact along travel', () => expect(contactFraction({ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 3, z: 0 }, 1)).toBeCloseTo(.4));
  it('no contact versus initial overlap', () => { expect(contactFraction({ x: 0, z: 0 }, { x: 0, z: 5 }, { x: 3, z: 0 }, 1)).toBe(null); expect(contactFraction({ x: 0, z: 0 }, { x: 0, z: 0 }, { x: .5, z: 0 }, 1)).toBe(0); });
  it('capture beats exactly simultaneous power', () => { const s = contact(); s.pickups = [{ id: 'tie', position: { ...s.position }, kind: 'charge', collected: false }]; s.step(1 / 60, idle); expect(s.mode).toBe('caught'); expect(s.pickups[0].collected).toBe(false); expect(s.overload).toBe(0); });
  it('power reached before enemy protects and banishes', () => { const s = contact(); s.enemies[0].position = { x: s.position.x + .83, z: s.position.z }; s.pickups = [{ id: 'first', position: { ...s.position }, kind: 'charge', collected: false }]; s.step(.05, { ...idle, right: 1 }); expect(s.mode).toBe('playing'); expect(s.overload).toBeGreaterThan(0); expect(s.enemies[0].state).toBe('returning'); });
  it('capture beats simultaneous unlocked exit', () => { const s = contact(); s.pickups.forEach(p => p.collected = true); s.position = worldAt(s.level.exit); s.enemies[0].position = { ...s.position }; s.step(1 / 60, idle); expect(s.mode).toBe('caught'); });
  it('30/60/120 render schedules give equivalent movement, score and waves', () => {
    const run = (fps: number) => { const s = new Simulation(); s.start(); let acc = 0; for (let f = 0; f < fps * 2; f++) { acc += 1 / fps; while (acc + 1e-10 >= 1 / 60) { s.step(1 / 60, { ...idle, forward: 1 }); acc -= 1 / 60; } } return [s.position.z, s.time, s.score, s.waveRemaining]; };
    for (const fps of [30, 120]) run(fps).forEach((v, i) => expect(v).toBeCloseTo(run(60)[i], 5));
  });
  it('huge deltas refused', () => { const s = new Simulation(); s.start(); s.step(10, { ...idle, forward: 1 }); expect(s.time).toBe(0); expect(s.position).toEqual(worldAt(s.level.start)); });
  it('NaN cannot poison timing', () => { const s = new Simulation(); s.start(); s.step(NaN, idle); expect(s.time).toBe(0); expect(s.stamina).toBe(100); });
  it('stable sprint exhaustion hysteresis', () => { const s = new Simulation(); s.start(); s.enemies = []; s.stamina = 1; s.step(1 / 60, { ...idle, forward: 1, sprint: true }); expect(s.sprinting).toBe(false); expect(s.exhausted).toBe(true); for (let i = 0; i < 40; i++) s.step(1 / 60, { ...idle, forward: 1, sprint: true }); expect(s.sprinting).toBe(false); s.step(1 / 60, idle); expect(s.exhausted).toBe(false); });
});
describe('perception and recovery under v2 rules', () => {
  it('locked hunter cannot exit onto player', () => { const s = new Simulation(), e = s.enemies[1]; s.time = 50; s.position = worldAt(s.level.lockup!.outside); stepEnemy(e, s, 1 / 60); expect(e.state).toBe('locked'); });
  it('last-seen map data not refreshed behind camera', () => { const s = new Simulation(), e = s.enemies[0]; s.position = worldAt(s.level.spots.encounter); e.position = { x: s.position.x, z: s.position.z + CELL }; s.time = 10; s.yaw = 0; stepEnemy(e, s, 1 / 60); expect(e.seenAt).toBeLessThan(0); s.yaw = Math.PI; stepEnemy(e, s, 1 / 60); expect(e.seenAt).toBe(s.time); });
  it('Weeper hears noise but other targets stay distinct', () => { const s = new Simulation(), e = s.enemies[3]; s.time = 10; e.position = worldAt(s.level.spots.contact); s.noises = [{ position: worldAt({ x: 1, z: 13 }), expires: 12 }]; expect(chaseTarget(e, s)).toEqual({ x: 1, z: 13 }); expect(chaseTarget(s.enemies[0], s)).toEqual(cellAt(s.position)); s.time = 13; expect(chaseTarget(e, s)).not.toEqual({ x: 1, z: 13 }); });
});
