// Phase 2 presentation only: transform and observation contracts are shared by
// the Canvas map, HUD and tests. Never change collision, AI, score or game time.
import { CELL, cellAt, lineOfSight, worldAt, type Point } from '../game/maze';
import { distance, waveDurations, type Archetype, type Enemy, type EnemyState } from '../game/hunters';
import type { Simulation } from '../game/simulation';

export type MapOptions = { highContrast: boolean; mapVisibility: 'confirmed' | 'arcade'; mapOrientation: 'north' | 'heading' };
export const DEFAULT_MAP: MapOptions = { highContrast: false, mapVisibility: 'confirmed', mapOrientation: 'north' };
export const HUNTER_STYLE: Record<Archetype, { letter: string; shape: 'circle' | 'diamond' | 'square' | 'triangle'; color: string }> = {
  Stalker: { letter: 'S', shape: 'circle', color: '#ffb49c' },
  Mimic: { letter: 'M', shape: 'diamond', color: '#ecd0fa' },
  Puppet: { letter: 'P', shape: 'square', color: '#a4e3f3' },
  Weeper: { letter: 'W', shape: 'triangle', color: '#f9dc8e' },
};
export type MapMarker = { id: number; kind: Archetype; state: EnemyState; position: Point; source: 'sight' | 'radar' | 'last-seen' | 'heard' | 'arcade'; age: number; uncertainty: number };
export function visibleToPlayer(sim: Simulation, e: Enemy): boolean {
  const d = distance(e.position, sim.position);
  const dot = (-(e.position.x - sim.position.x) * Math.sin(sim.yaw) - (e.position.z - sim.position.z) * Math.cos(sim.yaw)) / Math.max(.001, d);
  return d < 19 && dot > Math.cos(sim.viewFov * Math.PI / 360) && lineOfSight(sim.level, sim.position, e.position);
}
export function mapMarkers(sim: Simulation, options: MapOptions = DEFAULT_MAP): MapMarker[] {
  return sim.enemies.flatMap<MapMarker>(e => {
    const base = { id: e.id, kind: e.kind, state: e.state, age: 0, uncertainty: 0 };
    if (options.mapVisibility === 'arcade') return [{ ...base, position: { ...e.position }, source: 'arcade' as const }];
    // A locked hunter is not a current threat/sighting. Do not carry its old
    // outside location into the house after capture/return.
    if (['locked', 'recovery'].includes(e.state)) return [];
    if (sim.radar > 0 && distance(e.position, sim.position) < CELL * 8) return [{ ...base, position: { ...e.position }, source: 'radar' as const }];
    if (visibleToPlayer(sim, e)) return [{ ...base, position: { ...e.position }, source: 'sight' as const }];
    const age = sim.time - e.seenAt;
    if (e.lastSeen && age >= 0 && age < 4) return [{ ...base, position: { ...e.lastSeen }, source: 'last-seen' as const, age }];
    // Hearing is deliberately coarse, not wall-penetrating live tracking.
    // The existing positional audio/caption range is 16 world units. A dashed
    // uncertainty ring + ? explicitly distinguishes this estimate from a fix.
    if (distance(e.position, sim.position) < 16 && ['scatter', 'chase', 'frightened'].includes(e.state)) return [{ ...base, position: worldAt(cellAt(e.position)), source: 'heard' as const, uncertainty: CELL * 1.25 }];
    return [];
  });
}
export function mapTransform(sim: Simulation, size = 240, orientation: MapOptions['mapOrientation'] = 'north') {
  // Fit the whole maze even at 45 degrees. Heading-up rotates the whole grid,
  // not just the player arrow, and never clips a corner or moves the player.
  const angle = orientation === 'heading' ? sim.yaw : 0;
  const c = Math.cos(angle), s = Math.sin(angle), w = sim.level.width * CELL, h = sim.level.height * CELL;
  const rotatedW = Math.abs(w * c) + Math.abs(h * s), rotatedH = Math.abs(w * s) + Math.abs(h * c);
  const scale = (size - 26) / Math.max(rotatedW, rotatedH);
  const cx = w / 2, cz = h / 2;
  const project = (p: Point): Point => ({ x: size / 2 + ((p.x - cx) * c - (p.z - cz) * s) * scale, z: size / 2 + ((p.x - cx) * s + (p.z - cz) * c) * scale });
  return { angle, scale, center: { x: cx, z: cz }, project, playerAngle: angle - sim.yaw };
}
export function waveReadout(sim: Simulation) {
  if (sim.blackout) return { label: 'BLACKOUT', detail: 'FINAL DASH', ratio: 1, remaining: null, kind: 'blackout' };
  if (sim.overload > 0) return { label: 'OVERLOAD', detail: sim.overload < 2.5 ? 'POWER FADING' : 'HUNTERS FLEE', ratio: Math.min(1, sim.overload / sim.powerDuration), remaining: sim.overload, kind: 'overload' };
  const duration = waveDurations(sim.level.chapter, sim.night)[sim.waveIndex] ?? Infinity;
  return { label: sim.wave.toUpperCase(), detail: Number.isFinite(duration) ? sim.wave === 'scatter' ? 'RELIEF WINDOW' : 'HUNTERS TRACK YOU' : 'UNTIL ESCAPE', ratio: Number.isFinite(duration) ? Math.max(0, Math.min(1, sim.waveRemaining / duration)) : 1, remaining: Number.isFinite(sim.waveRemaining) ? sim.waveRemaining : null, kind: sim.wave };
}
export const markerLabel = (m: MapMarker) => m.source === 'heard' ? 'HEARD / ESTIMATE' : m.source === 'last-seen' ? `LAST SEEN / ${m.age.toFixed(1)}s` : m.state === 'returning' ? 'RETURNING WISP' : m.state === 'locked' || m.state === 'recovery' ? 'IN LOCKUP' : m.state === 'exiting' ? 'LEAVING LOCKUP' : m.source === 'radar' ? 'RADAR / LIVE' : m.source === 'arcade' ? 'ARCADE / LIVE' : 'IN VIEW / LIVE';
