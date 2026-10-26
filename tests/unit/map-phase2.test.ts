import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/game/simulation';
import { LEVELS, CELL, worldAt } from '../../src/game/levels';
import { DEFAULT_MAP, HUNTER_STYLE, mapMarkers, mapTransform, markerLabel, waveReadout } from '../../src/ui/mapModel';
import { defaults, validateSave } from '../../src/services/storage';
const setup = () => {
  const s = new Simulation(); s.position = worldAt({ x: 1, z: 19 }); s.yaw = 0; s.time = 10;
  s.enemies = [s.enemies[0]]; const e = s.enemies[0]; e.position = worldAt({ x: 1, z: 15 }); e.state = 'chase'; e.seenAt = -100; return s;
};
describe('shared map transform', () => {
  it('north up maps north to screen up and centre to centre', () => { const s = setup(), t = mapTransform(s); expect(t.project(t.center)).toEqual({ x: 120, z: 120 }); const p = t.project(s.position), n = t.project({ ...s.position, z: s.position.z - CELL }); expect(n.z).toBeLessThan(p.z); expect(n.x).toBe(p.x); });
  it('heading up keeps player arrow up for arbitrary camera yaw', () => { const s = setup(); for (const yaw of [0, .4, Math.PI / 2, Math.PI, 5.2]) { s.yaw = yaw; const t = mapTransform(s, 240, 'heading'), p = t.project(s.position), forward = t.project({ x: s.position.x - Math.sin(yaw), z: s.position.z - Math.cos(yaw) }); expect(forward.x).toBeCloseTo(p.x); expect(forward.z).toBeLessThan(p.z); expect(t.playerAngle).toBe(0); } });
  it('all four maze corners fit at every rotation and display size', () => { const s = setup(); for (const size of [120, 240, 400]) for (const angle of [0, Math.PI / 4, Math.PI / 2, 1.2, 4.8]) { s.yaw = angle; const t = mapTransform(s, size, 'heading'); for (const x of [0, s.level.width * CELL]) for (const z of [0, s.level.height * CELL]) { const p = t.project({ x, z }); expect(p.x).toBeGreaterThanOrEqual(12.9); expect(p.z).toBeGreaterThanOrEqual(12.9); expect(p.x).toBeLessThanOrEqual(size - 12.9); expect(p.z).toBeLessThanOrEqual(size - 12.9); } } });
  it('north-up paused projection is independent of camera facing', () => { const s = setup(); const a = mapTransform(s).project(s.position); s.yaw = 2; expect(mapTransform(s).project(s.position)).toEqual(a); });
});
describe('truthful hunter fixes', () => {
  it('shows direct sight as live', () => { const s = setup(), m = mapMarkers(s)[0]; expect(m.source).toBe('sight'); expect(m.position).toEqual(s.enemies[0].position); });
  it('an unseen nearby hunter gets an approximate heard marker, never a live fix', () => { const s = setup(); s.yaw = Math.PI; const m = mapMarkers(s)[0]; expect(m.source).toBe('heard'); expect(m.uncertainty).toBeGreaterThan(CELL); expect(markerLabel(m)).toBe('HEARD / ESTIMATE'); });
  it('distant unseen hunters remain unknown', () => { const s = setup(); s.enemies[0].position = worldAt({ x: 19, z: 1 }); expect(mapMarkers(s)).toEqual([]); });
  it('a blocked nearby sight line cannot become a live sighting', () => { const s = setup(); s.enemies[0].position = worldAt({ x: 5, z: 15 }); expect(mapMarkers(s)[0].source).toBe('heard'); });
  it('radar reveals nearby hunters even across walls', () => { const s = setup(); s.enemies[0].position = worldAt({ x: 5, z: 15 }); s.radar = 3; expect(mapMarkers(s)[0].source).toBe('radar'); });
  it('last-seen marker stays at the recorded position, expires at four seconds', () => { const s = setup(), e = s.enemies[0]; e.lastSeen = worldAt({ x: 1, z: 16 }); e.seenAt = 9; e.position = worldAt({ x: 19, z: 1 }); const m = mapMarkers(s)[0]; expect(m.source).toBe('last-seen'); expect(m.position).toEqual(e.lastSeen); expect(m.position).not.toEqual(e.position); s.time = 13; expect(mapMarkers(s)).toEqual([]); });
  it('Arcade tracking reveals every hunter with a declared source', () => { const s = new Simulation(); const ms = mapMarkers(s, { ...DEFAULT_MAP, mapVisibility: 'arcade' }); expect(ms).toHaveLength(4); expect(ms.every(m => m.source === 'arcade')).toBe(true); });
  it('locked hunters do not leave false markers outside in confirmed mode', () => { const s = setup(), e = s.enemies[0]; e.state = 'locked'; e.seenAt = 9; e.lastSeen = worldAt({ x: 1, z: 17 }); expect(mapMarkers(s)).toEqual([]); });
  it('returning wisps are distinctly identified when visible', () => { const s = setup(); s.enemies[0].state = 'returning'; expect(markerLabel(mapMarkers(s)[0])).toBe('RETURNING WISP'); });
  it('shape and letter identity is independent of color', () => { const styles = Object.values(HUNTER_STYLE); expect(new Set(styles.map(s => s.shape)).size).toBe(4); expect(styles.map(s => s.letter)).toEqual(['S', 'M', 'P', 'W']); });
  it('map presentation never mutates AI, resources, score or clocks', () => { const s = setup(), before = JSON.stringify(s); mapMarkers(s); mapTransform(s, 240, 'heading'); waveReadout(s); expect(JSON.stringify(s)).toBe(before); });
});
describe('timer ring and preferences', () => {
  it('ring uses remaining / duration, stays valid under permanent chase', () => { const s = setup(); s.waveRemaining = 4.5; expect(waveReadout(s).ratio).toBe(.5); s.waveIndex = 6; s.wave = 'chase'; s.waveRemaining = Infinity; expect(waveReadout(s)).toMatchObject({ label: 'CHASE', ratio: 1, remaining: null, detail: 'UNTIL ESCAPE' }); });
  it('overload and blackout take precedence over the wave timer', () => { const s = setup(); s.overload = 4; expect(waveReadout(s)).toMatchObject({ label: 'OVERLOAD', ratio: .5 }); s.blackout = true; expect(waveReadout(s)).toMatchObject({ label: 'BLACKOUT', remaining: null }); });
  it('old/hostile preference fields default safely', () => { const s = validateSave({ settings: { mapVisibility: 'omniscient', mapOrientation: 0 } }).settings; expect(s.mapVisibility).toBe('confirmed'); expect(s.mapOrientation).toBe('north'); });
  it('valid new map preferences survive validation', () => { const s = validateSave({ settings: { mapVisibility: 'arcade', mapOrientation: 'heading' } }).settings; expect(s.mapVisibility).toBe('arcade'); expect(s.mapOrientation).toBe('heading'); expect(defaults().mapOrientation).toBe('north'); });
});
