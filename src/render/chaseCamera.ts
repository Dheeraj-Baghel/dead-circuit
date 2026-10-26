// Camera geometry only. Never changes movement/AI or the collision graph.
import { collides } from '../game/movement';
import type { Level, Point } from '../game/maze';
export type CameraPoint = { x: number; y: number; z: number };
export const CAMERA_RADIUS = .16;
export function chaseCamera(level: Level, position: Point, yaw: number, pitch: number) {
  const backX = Math.sin(yaw), backZ = Math.cos(yaw);
  const anchor: CameraPoint = { x: position.x, y: .48, z: position.z };
  const desired: CameraPoint = { x: position.x + backX * 1.85 + Math.cos(yaw) * .18, y: Math.max(.8, Math.min(2.4, 1.45 - pitch * .85)), z: position.z + backZ * 1.85 - Math.sin(yaw) * .18 };
  const length = Math.hypot(desired.x - anchor.x, desired.z - anchor.z), steps = Math.max(1, Math.ceil(length / .035));
  let fraction = 0;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    // Extra 20 mm exceeds half the sampling stride, keeping the intervening
    // segments clear of the actual 160 mm camera clearance sphere as well.
    if (collides(level, { x: anchor.x + (desired.x - anchor.x) * f, z: anchor.z + (desired.z - anchor.z) * f }, CAMERA_RADIUS + .02)) break;
    fraction = f;
  }
  // Keep height above the actor even when the horizontal boom compresses into
  // a very tight corner. No camera-through-body or smoothing through walls.
  const eye: CameraPoint = { x: anchor.x + (desired.x - anchor.x) * fraction, y: desired.y, z: anchor.z + (desired.z - anchor.z) * fraction };
  const target: CameraPoint = { x: position.x - backX * .45, y: Math.max(.3, Math.min(.65, .4 + pitch * .2)), z: position.z - backZ * .45 };
  return { eye, target, desired, fraction };
}
