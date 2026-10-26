// Pure audio policy: testable without an AudioContext or audible output.
import { CELL, cellAt, lineOfSight, type Point } from '../game/maze';
import type { Simulation } from '../game/simulation';
import type { Enemy } from '../game/hunters';
export const AUDIO_FILES = {
  step0: 'footstep_concrete_000.ogg', step1: 'footstep_concrete_001.ogg', step2: 'footstep_concrete_002.ogg',
  metal: 'impactMetal_light_000.ogg', heavy: 'impactMetal_heavy_000.ogg', wood: 'impactWood_light_000.ogg', plate: 'impactPlate_light_000.ogg', bell: 'impactBell_heavy_000.ogg',
};
export type Sample = keyof typeof AUDIO_FILES;
export type FloorSound = 'tile' | 'wet' | 'metal' | 'concrete';
export const surfaceAt = (sim: Simulation): FloorSound => cellAt(sim.position).z === sim.level.tunnelRow ? 'metal' : sim.level.id === 'drainworks' ? 'wet' : sim.level.training ? 'concrete' : 'tile';
export function directionCaption(player: Point, yaw: number, source: Point): string {
  if (Math.hypot(source.x - player.x, source.z - player.z) < .5) return 'NEARBY';
  const angle = Math.atan2(source.x - player.x, -(source.z - player.z)) + yaw;
  return Math.cos(angle) < -.4 ? 'BEHIND' : Math.sin(angle) > .4 ? 'RIGHT' : Math.sin(angle) < -.4 ? 'LEFT' : 'AHEAD';
}
export const chapterMix = (id: string) => id === 'drainworks' ? { drones: [37, 55.5, 74], airHz: 680, machineHz: 92, gain: .9 } : id === 'core' ? { drones: [46, 69.3, 92.5], airHz: 330, machineHz: 138, gain: .8 } : { drones: [41, 61.8, 82.4], airHz: 470, machineHz: 110, gain: .75 };
export function hunterSound(sim: Simulation, e: Enemy) {
  const distance = Math.hypot(e.position.x - sim.position.x, e.position.z - sim.position.z);
  const active = ['chase', 'scatter', 'frightened', 'exiting'].includes(e.state);
  const blocked = !lineOfSight(sim.level, sim.position, e.position);
  const interval = (e.kind === 'Stalker' ? 1.1 : e.kind === 'Mimic' ? .65 : e.kind === 'Puppet' ? 1.45 : 2.4) * (e.state === 'chase' ? .85 : 1.2);
  return { audible: active && distance < 28, caption: active && distance < 16, blocked, distance, interval, cutoff: blocked ? 370 : 2600, gain: blocked ? .06 : .16 };
}
export function threatPressure(sim: Simulation): number {
  if (sim.safe || sim.overload > 0 || sim.time < sim.grace || sim.mode !== 'playing') return 0;
  const nearest = sim.enemies.filter(e => ['chase', 'scatter'].includes(e.state)).reduce((d, e) => Math.min(d, Math.hypot(e.position.x - sim.position.x, e.position.z - sim.position.z)), Infinity);
  return Math.max(0, Math.min(1, 1 - nearest / (CELL * 5)));
}
export type SoundCaption = { text: string; until: number; priority: number; category: 'signal' | 'scare' | 'hunter' };
export const HUNTER_CAPTION = { Stalker: 'HEAVY DRAGGING STEPS', Mimic: 'YOUR FOOTSTEPS, FROM ELSEWHERE', Puppet: 'WIRE CREAK / WOODEN KNOCK', Weeper: 'WORDLESS SOBBING' };
