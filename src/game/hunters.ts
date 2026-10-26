// Arcade-inspired targeting with original tuning. Normal hunters choose ONE
// junction exit by squared target distance (not global A*). Only wisps/Lockup
// departures use shortest paths. Camera-facing targets do not implement ROM bugs.
import { CELL, cellAt, findPath, isWall, key, lineOfSight, symbolAt, worldAt, type Cell, type Level, type Point } from './maze';
export const HUNTERS = ['Stalker', 'Mimic', 'Puppet', 'Weeper'] as const;
export type Archetype = typeof HUNTERS[number];
export type WaveMode = 'scatter' | 'chase';
export type EnemyState = WaveMode | 'frightened' | 'returning' | 'locked' | 'exiting' | 'recovery';
export type Noise = { position: Point; expires: number };
export type Enemy = {
  id: number; kind: Archetype; position: Point; previous: Point; home: Cell; corner: Cell;
  state: EnemyState; route: Cell[]; target: Cell | null; dir: number; reversePending: boolean;
  heading: number; seenAt: number; lastSeen: Point | null; recoverUntil: number;
  released: boolean; releaseDots: number; releaseAt: number; rng: number;
};
export type AIContext = {
  level: Level; position: Point; yaw: number; time: number; overload: number;
  noises: Noise[]; relaxed: boolean; grace: number; viewFov?: number;
  enemies?: Enemy[]; wave?: WaveMode; remaining?: number; dotsEaten?: number;
  releaseDots?: number; lastMoteAt?: number; night?: number; blackout?: boolean;
};
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// Stable ties: up, left, down, right. Opposite direction is (dir + 2) % 4.
export const DIRECTIONS: Cell[] = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }];
export function facing(yaw: number): Cell {
  const x = -Math.sin(yaw), z = -Math.cos(yaw);
  return Math.abs(x) > Math.abs(z) ? { x: Math.sign(x), z: 0 } : { x: 0, z: Math.sign(z) };
}
export function chaseTarget(e: Enemy, ctx: AIContext): Cell {
  const player = cellAt(ctx.position), f = facing(ctx.yaw);
  // Final dash overrides ambush/retreat/hearing personalities: every hunter
  // pursues the current player tile. House/return permissions stay unchanged.
  if (ctx.blackout) return player;
  const ahead = (n: number) => ({ x: player.x + f.x * n, z: player.z + f.z * n });
  if (e.kind === 'Stalker') return player;
  if (e.kind === 'Mimic') return ahead(4);
  if (e.kind === 'Puppet') {
    const pivot = ahead(2), stalker = cellAt(ctx.enemies?.find(h => h.kind === 'Stalker')?.position ?? ctx.position);
    return { x: pivot.x * 2 - stalker.x, z: pivot.z * 2 - stalker.z };
  }
  const noise = ctx.noises.filter(n => n.expires > ctx.time && distance(n.position, e.position) < CELL * 8).at(-1);
  if (noise) return cellAt(noise.position);
  return distance(e.position, ctx.position) > CELL * 8 ? player : e.corner;
}
export const waveDurations = (chapter = 1, night = 1) => {
  const scatter = Math.max(4, 10 - chapter - Math.floor((night - 1) / 2));
  const chase = 16 + chapter * 2 + Math.min(10, night - 1);
  return [scatter, chase, scatter, chase, scatter, chase, Infinity];
};
export function makeEnemies(level: Level, kinds: readonly Archetype[] = level.training ? ['Stalker'] : HUNTERS, time = 0, respawn = false): Enemy[] {
  const corners = [{ x: level.width - 2, z: 1 }, { x: 1, z: 1 }, { x: level.width - 2, z: level.height - 2 }, { x: 1, z: level.height - 2 }];
  return kinds.map((kind, id) => {
    const home = level.lockup?.homes[id % level.lockup.homes.length] ?? level.spots.encounterHunter;
    const released = !level.lockup || (id === 0 && !respawn);
    const position = worldAt(released && level.lockup ? level.lockup.outside : home);
    return { id, kind, position, previous: { ...position }, home, corner: corners[id], state: released ? 'scatter' : 'locked',
      route: [], target: null, dir: 0, reversePending: false, heading: Math.PI, seenAt: -100, lastSeen: null, recoverUntil: 0,
      released, releaseDots: respawn ? id * 10 : [0, 8, 25, 45][id], releaseAt: time + (respawn ? 3 : 2) + id * 4, rng: 501 + id * 971 };
  });
}
function random(e: Enemy): number { e.rng = (Math.imul(e.rng, 1664525) + 1013904223) >>> 0; return e.rng / 4294967296; }
function exitOptions(e: Enemy, level: Level): { cell: Cell; dir: number }[] {
  const c = cellAt(e.position);
  return DIRECTIONS.flatMap((d, dir) => {
    let x = c.x + d.x, z = c.z + d.z;
    if (z === level.tunnelRow) x = (x + level.width) % level.width;
    // Normal hunters can't turn back into their house. Exit/return use explicit paths.
    return !isWall(level, x, z) ? [{ cell: { x, z }, dir }] : [];
  });
}
export function chooseExit(e: Enemy, level: Level, target: Cell, frightened = false): Cell | null {
  let options = exitOptions(e, level);
  const reverse = options.find(o => o.dir === (e.dir + 2) % 4);
  if (e.reversePending && reverse) { e.reversePending = false; e.dir = reverse.dir; return reverse.cell; }
  e.reversePending = false;
  const nonReverse = options.filter(o => o.dir !== (e.dir + 2) % 4);
  if (nonReverse.length) options = nonReverse;
  if (!options.length) return null;
  const selected = frightened ? options[Math.floor(random(e) * options.length)] : options.reduce((best, o) => {
    const d = (o.cell.x - target.x) ** 2 + (o.cell.z - target.z) ** 2;
    const b = (best.cell.x - target.x) ** 2 + (best.cell.z - target.z) ** 2;
    return d < b ? o : best;
  });
  e.dir = selected.dir; return selected.cell;
}
export function hunterSpeed(e: Enemy, ctx: AIContext): number {
  let speed = e.state === 'returning' ? 6.4 : e.state === 'frightened' ? 2 : 2.5 + (ctx.level.chapter ?? 1) * .2 + Math.min(.4, ((ctx.night ?? 1) - 1) * .08);
  if (e.kind === 'Stalker' && e.state !== 'returning' && e.state !== 'frightened') speed += (ctx.remaining ?? Infinity) <= 10 ? .5 : (ctx.remaining ?? Infinity) <= 20 ? .25 : 0;
  if (symbolAt(ctx.level, cellAt(e.position).x, cellAt(e.position).z) === 'T' && e.state !== 'returning') speed *= .5;
  return speed * (ctx.relaxed ? .72 : 1) * (ctx.level.training ? .6 : 1);
}
export const isDangerous = (e: Enemy) => ['scatter', 'chase', 'frightened'].includes(e.state);
export function reverseHunters(enemies: Enemy[]) {
  for (const e of enemies) if (isDangerous(e)) e.reversePending = true;
}
export function stepEnemy(e: Enemy, ctx: AIContext, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > .1) return;
  e.previous = { ...e.position };
  if (e.recoverUntil > ctx.time) return;
  if (e.state === 'recovery') e.state = 'locked';
  if (e.state === 'locked') {
    const enoughDots = (ctx.releaseDots ?? ctx.dotsEaten ?? 0) >= e.releaseDots;
    if (!(ctx.time >= ctx.grace && (enoughDots || ctx.time >= e.releaseAt))) return;
    if (ctx.level.lockup && distance(ctx.position, worldAt(ctx.level.lockup.outside)) < CELL * 3) return;
    e.state = 'exiting'; e.route = [];
  }
  const separation = distance(e.position, ctx.position);
  const dot = (-(e.position.x - ctx.position.x) * Math.sin(ctx.yaw) - (e.position.z - ctx.position.z) * Math.cos(ctx.yaw)) / Math.max(.001, separation);
  if (isDangerous(e) && separation < 19 && dot > Math.cos((ctx.viewFov ?? 95) * Math.PI / 360) && lineOfSight(ctx.level, ctx.position, e.position)) { e.seenAt = ctx.time; e.lastSeen = { ...e.position }; }
  if (isDangerous(e)) e.state = !ctx.blackout && ctx.overload > 0 ? 'frightened' : ctx.wave ?? 'chase';
  if (!e.route.length) {
    const current = cellAt(e.position);
    // Correct fixture/restore positions to cell centre before selecting a new junction.
    if (distance(e.position, worldAt(current)) > .001) e.route = [current];
    else if (e.state === 'returning' || e.state === 'exiting') {
      const goal = e.state === 'returning' ? e.home : ctx.level.lockup?.outside ?? e.home;
      if (key(current) === key(goal)) {
        if (e.state === 'returning') { e.state = 'locked'; e.recoverUntil = ctx.time + 2; e.releaseAt = ctx.time + 2; e.releaseDots = 0; e.seenAt = -100; e.lastSeen = null; }
        else { e.state = ctx.overload > 0 && !ctx.blackout ? 'frightened' : ctx.wave ?? 'chase'; e.released = true; e.dir = 0; }
        return;
      }
      e.route = findPath(ctx.level, current, goal, 'hunter').slice(1, 2);
    } else {
      e.target = e.state === 'scatter' && !(e.kind === 'Stalker' && (ctx.remaining ?? Infinity) <= 20) ? e.corner : chaseTarget(e, ctx);
      const next = chooseExit(e, ctx.level, e.target, e.state === 'frightened'); if (next) e.route = [next];
    }
  }
  const waypoint = e.route[0]; if (!waypoint) return;
  const goal = worldAt(waypoint), span = ctx.level.width * CELL;
  if (cellAt(e.position).z === ctx.level.tunnelRow && waypoint.z === ctx.level.tunnelRow) {
    if (goal.x - e.position.x > span / 2) goal.x -= span;
    else if (goal.x - e.position.x < -span / 2) goal.x += span;
  }
  const d = distance(e.position, goal), amount = Math.min(d, hunterSpeed(e, ctx) * dt);
  if (d > .00001) { e.heading = Math.atan2(goal.x - e.position.x, goal.z - e.position.z); e.position.x += (goal.x - e.position.x) / d * amount; e.position.z += (goal.z - e.position.z) / d * amount; }
  if (e.position.z >= (ctx.level.tunnelRow ?? -2) * CELL && e.position.z < ((ctx.level.tunnelRow ?? -2) + 1) * CELL) e.position.x = (e.position.x + span) % span;
  if (d <= amount + .00001) { e.position = worldAt(waypoint); e.route = []; }
}
