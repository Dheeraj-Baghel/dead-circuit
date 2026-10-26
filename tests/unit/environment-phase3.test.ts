import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LEVELS, TRAINING, CELL, isWall, key } from '../../src/game/levels';
import { createCreature, animateCreature, CREATURE_IDENTITIES } from '../../src/render/creature';
import { landmarkSites, NICHE } from '../../src/render/landmarks';
import { chapterLook } from '../../src/render/lighting';
import { makeEnemies } from '../../src/game/hunters';

function dispose(root: THREE.Object3D) { const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(); root.traverse(o => { if (o instanceof THREE.Mesh) { geos.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m); } }); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); }
describe('collision-safe landmark plan', () => {
  for (const l of LEVELS) it(`${l.id}: eight unique recesses stay in real walls adjacent to real corridors`, () => {
    const before = JSON.stringify(l), sites = landmarkSites(l); expect(sites).toHaveLength(8); expect(new Set(sites.map(s => key(s.wall))).size).toBe(8);
    for (const s of sites) { expect(l.grid[s.wall.z][s.wall.x]).toBe('#'); expect(isWall(l, s.corridor.x, s.corridor.z)).toBe(false); expect(Math.abs(s.dx) + Math.abs(s.dz)).toBe(1); expect(NICHE.depth).toBeLessThan(CELL); expect(NICHE.width).toBeLessThan(CELL); }
    expect(JSON.stringify(l)).toBe(before);
  });
  it('training remains uncluttered', () => expect(landmarkSites(TRAINING)).toEqual([]));
  it('chapter accents, fog and practical lighting are distinct', () => { expect(new Set(LEVELS.map(l => chapterLook(l.id).fog)).size).toBe(3); expect(new Set(LEVELS.map(l => chapterLook(l.id).lamp)).size).toBe(3); });
});
describe('original creature silhouettes and safe animation', () => {
  const enemies = makeEnemies(LEVELS[0]);
  for (const enemy of enemies) it(`${enemy.kind}: merged low-poly geometry fits a corridor with bounded drawables`, () => {
    const group = createCreature(enemy.kind); expect(group.userData.silhouette).toBe(CREATURE_IDENTITIES[enemy.kind]);
    group.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThan(2.8); expect(box.max.y).toBeLessThan(3.44); expect(size.z).toBeLessThan(2.8);
    let meshes = 0; group.traverse(o => { if (o instanceof THREE.Mesh) { meshes++; expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true); expect(o.geometry.attributes.color || o.material instanceof THREE.MeshStandardMaterial).toBeTruthy(); } });
    expect(meshes).toBeLessThanOrEqual(7); dispose(group);
  });
  it('models have four distinct silhouettes and at least three distinct heights', () => {
    const heights = enemies.map(e => { const g = createCreature(e.kind); const h = new THREE.Box3().setFromObject(g).max.y; dispose(g); return h.toFixed(1); });
    expect(new Set(Object.values(CREATURE_IDENTITIES)).size).toBe(4); expect(new Set(heights).size).toBeGreaterThanOrEqual(3);
  });
  it('reduced motion freezes limb poses and body motion without mutating enemy state', () => {
    const e = enemies[2], g = createCreature(e.kind), before = JSON.stringify(e); animateCreature(g, e, 2, true); const pose = g.children.map(c => c.rotation.toArray());
    animateCreature(g, e, 100, true); expect(g.children.map(c => c.rotation.toArray())).toEqual(pose); expect(g.position.y).toBe(0); expect(JSON.stringify(e)).toBe(before); dispose(g);
  });
  it('returning state shows only a wisp and locked state hides the model', () => {
    const e = { ...enemies[0], state: 'returning' as const }, g = createCreature(e.kind); animateCreature(g, e, 1); expect(g.children.filter(c => c.visible)).toHaveLength(1); expect(g.userData.wisp.visible).toBe(true); animateCreature(g, { ...e, state: 'locked' }, 1); expect(g.visible).toBe(false); dispose(g);
  });
});
