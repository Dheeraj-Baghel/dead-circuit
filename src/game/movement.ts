import { CELL, isWall, type Level, type Point } from './levels';
export const PLAYER_RADIUS = .28;
export type Travel = { from: Point; to: Point; start: number; end: number };

export function contactFraction(from: Point, to: Point, center: Point, radius: number): number | null {
  const fx = from.x - center.x, fz = from.z - center.z, dx = to.x - from.x, dz = to.z - from.z;
  const c = fx * fx + fz * fz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz; if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fz * dz), disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
export function collides(level: Level, p: Point, radius = PLAYER_RADIUS): boolean {
  for (let z = Math.floor((p.z - radius) / CELL); z <= Math.floor((p.z + radius) / CELL); z++) {
    for (let x = Math.floor((p.x - radius) / CELL); x <= Math.floor((p.x + radius) / CELL); x++) {
      if (!isWall(level, x, z)) continue;
      const cx = Math.max(x * CELL, Math.min(p.x, (x + 1) * CELL));
      const cz = Math.max(z * CELL, Math.min(p.z, (z + 1) * CELL));
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < radius * radius) return true;
    }
  }
  return false;
}
// Keep portal travel as two LOCAL segments. A line from left to right across
// the entire maze must never collect distant motes or collide with a hunter.
export function moveTravel(level: Level, position: Point, dx: number, dz: number): { position: Point; segments: Travel[]; wrapX: number } {
  const p = { ...position }, segments: Travel[] = []; let wrapX = 0;
  if (!Number.isFinite(dx + dz)) return { position: p, segments, wrapX };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (PLAYER_RADIUS * .5)));
  for (let i = 0; i < steps; i++) {
    const from = { ...p }, px = { x: p.x + dx / steps, z: p.z };
    if (!collides(level, px)) p.x = px.x;
    const pz = { x: p.x, z: p.z + dz / steps };
    if (!collides(level, pz)) p.z = pz.z;
    const span = level.width * CELL, start = i / steps, end = (i + 1) / steps;
    if (Math.floor(p.z / CELL) === level.tunnelRow && (p.x < 0 || p.x >= span)) {
      const boundary = p.x < 0 ? 0 : span, shift = p.x < 0 ? span : -span;
      const t = (boundary - from.x) / (p.x - from.x), crossing = { x: boundary, z: from.z + (p.z - from.z) * t };
      segments.push({ from, to: crossing, start, end: start + (end - start) * t });
      const to = { x: p.x + shift, z: p.z };
      segments.push({ from: { x: boundary + shift, z: crossing.z }, to, start: start + (end - start) * t, end });
      p.x = to.x; wrapX += shift;
    } else segments.push({ from, to: { ...p }, start, end });
  }
  return { position: p, segments, wrapX };
}
export const moveCircle = (level: Level, p: Point, dx: number, dz: number) => moveTravel(level, p, dx, dz).position;
export function direction(yaw: number, forward: number, right: number): Point {
  const length = Math.max(1, Math.hypot(forward, right));
  return { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length };
}
