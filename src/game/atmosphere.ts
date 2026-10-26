// Non-authoritative presentation clock: never mutates simulation, AI, score or
// gameplay randomness. Cosmetic events exist only in distant-threat SCATTER
// relief, never chase/overload/blackout/training, and cancel if danger approaches.
import { CELL, cellAt, lineOfSight, walkable, worldAt, type Point } from './maze';
import type { Simulation } from './simulation';
import { landmarkSites } from '../render/landmarks';
export type ScareKind = 'lamp' | 'screen' | 'steps' | 'whisper' | 'silhouette';
export type ScareEvent = { id: number; kind: ScareKind; start: number; duration: number; caption: string; position: Point };
export const SCARE_KINDS: ScareKind[] = ['lamp', 'screen', 'steps', 'silhouette', 'whisper'];
export const SCARE_DURATION: Record<ScareKind, number> = { lamp: 2.2, screen: 3, steps: 2.4, silhouette: 2.5, whisper: 2.4 };
export const SCARE_CAPTION: Record<ScareKind, string> = { lamp: 'A lamp slowly fades, then recovers.', screen: 'An abandoned screen powers up.', steps: 'Distant footsteps stop. Not yours.', silhouette: 'A distant shadow crosses the passage.', whisper: 'Air whispers through the service tunnel.' };
export function reliefSafe(sim: Simulation): boolean {
  if (sim.mode !== 'playing' || sim.level.training || sim.safe || sim.blackout || sim.overload > 0 || sim.wave !== 'scatter' || sim.time < sim.grace + 5) return false;
  return !sim.enemies.some(e => ['chase', 'scatter', 'frightened', 'exiting'].includes(e.state) && (
    Math.hypot(e.position.x - sim.position.x, e.position.z - sim.position.z) < CELL * 7 ||
    (Math.hypot(e.position.x - sim.position.x, e.position.z - sim.position.z) < CELL * 10 && lineOfSight(sim.level, sim.position, e.position))
  ));
}
export function scarePosition(sim: Simulation, kind: ScareKind): Point | null {
  const distance = (p: Point) => Math.hypot(p.x - sim.position.x, p.z - sim.position.z);
  const forward = (p: Point) => (-(p.x - sim.position.x) * Math.sin(sim.yaw) - (p.z - sim.position.z) * Math.cos(sim.yaw)) / Math.max(.001, distance(p));
  if (kind === 'screen') {
    const site = landmarkSites(sim.level).find(s => ['arcade-machine', 'ticket-machine'].includes(s.kind) && distance(worldAt(s.corridor)) < CELL * 5 && lineOfSight(sim.level, sim.position, worldAt(s.corridor)));
    return site ? worldAt(site.corridor) : null;
  }
  if (kind === 'whisper' && cellAt(sim.position).z !== sim.level.tunnelRow) return null;
  if (kind === 'lamp' || kind === 'whisper') return { ...sim.position };
  const candidates = walkable(sim.level).map(worldAt).filter(p => distance(p) >= CELL * 3 && distance(p) <= CELL * 6 && lineOfSight(sim.level, sim.position, p));
  const p = candidates.find(p => kind === 'silhouette' ? forward(p) > .7 : forward(p) < .2);
  return p ? { ...p } : null;
}
export class Atmosphere {
  active: ScareEvent | null = null;
  nextAt = 60; count = 0;
  private bound: Simulation | null = null;
  private captures = 0;
  reset(time = 0) { this.active = null; this.nextAt = time + 60; this.count = 0; }
  update(sim: Simulation, reducedScares: boolean, reducedMotion = false) {
    if (this.bound !== sim || this.captures !== sim.captures) { this.bound = sim; this.captures = sim.captures; this.reset(sim.time); }
    if (reducedScares) { this.active = null; this.nextAt = Math.max(this.nextAt, sim.time + 60); return; }
    if (reducedMotion && this.active && ['lamp', 'screen', 'silhouette'].includes(this.active.kind)) this.active = null;
    if (sim.mode === 'paused') return; // Retain exact phase across pause/resume.
    if (!reliefSafe(sim)) { this.active = null; return; }
    if (this.active) {
      if (sim.time >= this.active.start + this.active.duration || (this.active.kind === 'silhouette' && Math.hypot(this.active.position.x - sim.position.x, this.active.position.z - sim.position.z) < CELL * 2)) this.active = null;
      return;
    }
    if (sim.time < this.nextAt) return;
    // Prefer the next authored direction, skipping ineligible screen/tunnel/
    // sight-line contexts. No catch-up queue or random jump on resume.
    for (let offset = 0; offset < SCARE_KINDS.length; offset++) {
      const kind = SCARE_KINDS[(this.count + offset) % SCARE_KINDS.length], duration = SCARE_DURATION[kind];
      if (reducedMotion && ['lamp', 'screen', 'silhouette'].includes(kind)) continue;
      if (sim.waveRemaining < duration + .5) continue;
      const position = scarePosition(sim, kind); if (!position) continue;
      this.count++; this.active = { id: this.count, kind, start: sim.time, duration, caption: SCARE_CAPTION[kind], position };
      this.nextAt = sim.time + [75, 85, 65, 80, 70][(this.count - 1) % 5]; return;
    }
  }
}
export const scareEnvelope = (event: ScareEvent | null, time: number) => event ? Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, (time - event.start) / event.duration)))) : 0;
