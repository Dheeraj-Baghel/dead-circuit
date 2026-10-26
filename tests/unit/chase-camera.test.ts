import { describe, expect, it } from 'vitest';
import { chaseCamera, CAMERA_RADIUS } from '../../src/render/chaseCamera';
import { collides, PLAYER_RADIUS } from '../../src/game/movement';
import { LEVELS, TRAINING, CELL, walkable, worldAt } from '../../src/game/levels';
import { defaults, validateSave } from '../../src/services/storage';
import { PLAYER_VISUAL_RADIUS } from '../../src/render/player';
describe('third-person camera clearance', () => {
  for (const level of [TRAINING, ...LEVELS]) it(`${level.id}: every corridor centre and orbit angle has a collision-clear camera boom`, () => {
    for (const cell of walkable(level)) for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const p = worldAt(cell), c = chaseCamera(level, p, yaw, 0);
      expect(collides(level, c.eye, CAMERA_RADIUS)).toBe(false);
      for (let i = 0; i <= 12; i++) expect(collides(level, { x: p.x + (c.eye.x - p.x) * i / 12, z: p.z + (c.eye.z - p.z) * i / 12 }, CAMERA_RADIUS)).toBe(false);
      expect(c.eye.y).toBeGreaterThanOrEqual(.8); expect(c.eye.y + CAMERA_RADIUS).toBeLessThan(2.8);
    }
  });
  it('the camera compresses before the wall behind the Service Loop start', () => {
    const l = LEVELS[0], p = worldAt(l.start), c = chaseCamera(l, p, 0, 0);
    expect(c.fraction).toBeLessThan(1); expect(c.fraction).toBeGreaterThan(0); expect(collides(l, c.desired, CAMERA_RADIUS)).toBe(true); expect(collides(l, c.eye, CAMERA_RADIUS)).toBe(false);
  });
  it('near-wall positions remain safe through pitch extremes', () => {
    const l = LEVELS[0];
    for (const x of [CELL + PLAYER_RADIUS + .001, CELL * 2 - PLAYER_RADIUS - .001]) {
      const p = { x, z: CELL * 15.5 }; expect(collides(l, p)).toBe(false);
      for (const yaw of [0, .7, 2, 3.8]) for (const pitch of [-1.2, 0, 1.2]) expect(collides(l, chaseCamera(l, p, yaw, pitch).eye, CAMERA_RADIUS)).toBe(false);
    }
  });
  it('keeps the visible player envelope inside the existing collider', () => expect(PLAYER_VISUAL_RADIUS).toBeLessThan(PLAYER_RADIUS));
  it('does not mutate level data or the player position', () => { const l = LEVELS[0], p = worldAt(l.start), before = JSON.stringify([l, p]); chaseCamera(l, p, .7, -.4); expect(JSON.stringify([l, p])).toBe(before); });
  it('third person is default for old saves, and explicit first-person preferences remain valid', () => { expect(defaults().cameraMode).toBe('third'); expect(validateSave({ settings: { cameraMode: 'invalid' } }).settings.cameraMode).toBe('third'); expect(validateSave({ settings: { cameraMode: 'first' } }).settings.cameraMode).toBe('first'); });
});
