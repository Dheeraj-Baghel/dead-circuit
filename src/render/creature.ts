import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Enemy } from '../game/ai';

// Four original silhouettes, not rescaled copies. Static colored parts are
// merged, articulated limbs share one vertex-color material to bound draw calls.
export const CREATURE_IDENTITIES = { Stalker: 'porcelain-mask / long coat', Mimic: 'four-limbed crawling mannequin', Puppet: 'suspended marionette / hanging wires', Weeper: 'hunched shroud / clasped hands' };
type AnimatedLimb = { mesh: THREE.Mesh; rest: THREE.Euler; axis: 'x' | 'z'; phase: number; gain: number };
export function createCreature(kind: string): THREE.Group {
  const root = new THREE.Group(); root.name = `creature:${kind}`;
  root.userData.silhouette = CREATURE_IDENTITIES[kind as keyof typeof CREATURE_IDENTITIES];
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .76, metalness: .08 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffa56f', emissive: '#ed6a40', emissiveIntensity: 2.2, roughness: .5 });
  const shapes: THREE.BufferGeometry[] = [], luminous: THREE.BufferGeometry[] = [], limbs: AnimatedLimb[] = [];
  const add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1], rotation: [number, number, number] = [0, 0, 0], list = shapes) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); list.push(g);
  };
  const sphere = (r: number) => new THREE.SphereGeometry(r, 12, 8);
  const bone = '#c4b8a0', dark = '#20232b', cloth = '#38353b', rust = '#755445';
  const eye = (x: number, y: number, z: number, r = .028) => add(sphere(r), '#ffffff', x, y, z, [1, 1, .5], [0, 0, 0], luminous);
  const limb = (x: number, y: number, z: number, length: number, thickness: number, rx: number, rz: number, phase: number, color = bone) => {
    const list: THREE.BufferGeometry[] = [];
    add(new THREE.CylinderGeometry(thickness, thickness * .72, length, 7), color, 0, -length / 2, 0, [1, 1, 1], [0, 0, 0], list);
    add(sphere(thickness * 1.25), rust, 0, -length * .56, .01, [1, 1, 1], [0, 0, 0], list);
    add(new THREE.BoxGeometry(thickness * 1.6, .16, thickness * 1.15), color, 0, -length, .035, [1, 1, 1], [0, 0, 0], list);
    const g = mergeGeometries(list)!; list.forEach(a => a.dispose()); const mesh = new THREE.Mesh(g, material); mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); mesh.castShadow = true; root.add(mesh);
    limbs.push({ mesh, rest: mesh.rotation.clone(), axis: kind === 'Puppet' ? 'z' : 'x', phase, gain: kind === 'Mimic' ? .24 : .14 });
  };
  if (kind === 'Stalker') {
    add(new THREE.CylinderGeometry(.25, .46, 1.5, 9), dark, 0, 1.02, 0, [1, 1, .66]);
    add(new THREE.BoxGeometry(.68, .17, .3), cloth, 0, 1.73, 0);
    add(sphere(.29), bone, 0, 2.1, .015, [.83, 1.25, .72]);
    add(new THREE.BoxGeometry(.38, .08, .08), '#0d1018', 0, 2.13, .207);
    add(new THREE.BoxGeometry(.085, .18, .04), rust, .055, 1.97, .22, [1, 1, 1], [0, 0, -.15]);
    eye(-.085, 2.13, .252); eye(.085, 2.13, .252);
    for (const s of [-1, 1]) { limb(s * .4, 1.7, .015, 1.23, .055, 0, s * .12, s > 0 ? Math.PI : 0, '#343238'); add(new THREE.BoxGeometry(.12, .15, .37), dark, s * .15, .11, .05); }
    for (const x of [-.2, -.1, .1, .2]) add(new THREE.CylinderGeometry(.012, .004, .42, 4), rust, x, .17, 0);
  } else if (kind === 'Mimic') {
    add(new THREE.CylinderGeometry(.21, .28, .85, 9), bone, 0, .63, 0, [1, 1, .68], [Math.PI / 2, 0, 0]);
    add(sphere(.23), bone, 0, .64, .57, [.9, 1.1, .8], [0, 0, .25]);
    add(new THREE.BoxGeometry(.28, .06, .06), '#0d1018', 0, .68, .75); eye(-.064, .69, .79); eye(.064, .69, .79);
    for (const s of [-1, 1]) { limb(s * .28, .65, .28, .64, .055, -.45, s * .65, s > 0 ? Math.PI : 0); limb(s * .27, .6, -.33, .62, .06, .35, s * .7, s > 0 ? 0 : Math.PI); }
    for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(.12, .018, 4, 10), rust, 0, .78, -.27 + i * .12, [1, 1, .7], [Math.PI / 2, 0, 0]);
  } else if (kind === 'Puppet') {
    add(new THREE.CylinderGeometry(.22, .13, .55, 8), rust, 0, 1.7, 0, [1, 1, .65]);
    add(new THREE.BoxGeometry(.5, .07, .19), bone, 0, 2.03, 0);
    add(sphere(.23), bone, 0, 2.25, 0, [1, 1.1, .8], [0, 0, -.2]);
    add(new THREE.BoxGeometry(.25, .12, .04), '#11131a', 0, 2.23, .17);
    eye(-.07, 2.28, .215); eye(.07, 2.28, .215);
    for (const s of [-1, 1]) { limb(s * .29, 2.02, 0, .74, .041, 0, s * .5, s > 0 ? Math.PI : 0); limb(s * .12, 1.46, 0, .82, .045, 0, s * .13, s > 0 ? 0 : Math.PI); }
    for (const x of [-.42, -.2, 0, .2, .42]) add(new THREE.CylinderGeometry(.005, .005, .9, 3), '#7a7774', x, 2.87, 0, [1, 1, 1], [0, 0, x * .15]);
    add(new THREE.BoxGeometry(1.05, .06, .09), dark, 0, 3.3, 0);
  } else {
    add(new THREE.CylinderGeometry(.22, .48, 1.1, 10), cloth, 0, .63, -.03, [1, 1, .8], [.25, 0, 0]);
    add(sphere(.35), cloth, 0, 1.31, .12, [1, 1.2, .85]);
    add(sphere(.22), bone, 0, 1.4, .37, [.7, .95, .45], [.5, 0, 0]);
    add(new THREE.BoxGeometry(.2, .12, .035), '#10121a', 0, 1.46, .45); eye(-.05, 1.45, .47, .022); eye(.05, 1.45, .47, .022);
    for (const s of [-1, 1]) { limb(s * .3, 1.2, .2, .65, .065, -.65, -s * .25, s > 0 ? .2 : 0, cloth); add(sphere(.08), bone, s * .1, .83, .56); }
    for (let i = 0; i < 9; i++) add(new THREE.ConeGeometry(.04, .4, 3), '#22202b', (i - 4) * .085, .17, .04);
  }
  for (const [list, mat] of [[shapes, material], [luminous, glow]] as const) {
    if (!list.length) continue; const g = mergeGeometries(list)!; list.forEach(a => a.dispose()); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mat === material; root.add(mesh);
  }
  const wisp = new THREE.Mesh(new THREE.OctahedronGeometry(.11), glow); wisp.visible = false; root.add(wisp);
  root.userData.limbs = limbs; root.userData.glow = glow; root.userData.wisp = wisp; root.userData.parts = root.children.filter(c => c !== wisp);
  return root;
}
export function animateCreature(group: THREE.Group, enemy: Enemy, time: number, reducedMotion = false) {
  group.visible = !['recovery', 'locked'].includes(enemy.state);
  const returning = enemy.state === 'returning';
  for (const child of group.userData.parts as THREE.Object3D[]) child.visible = !returning;
  (group.userData.wisp as THREE.Mesh).visible = returning;
  group.position.set(enemy.position.x, returning ? 1.2 : reducedMotion ? 0 : Math.sin(time * 2 + enemy.id) * (enemy.kind === 'Puppet' ? .06 : .015), enemy.position.z);
  group.rotation.set(0, enemy.heading, !reducedMotion && enemy.kind === 'Weeper' ? Math.sin(time * .9) * .025 : 0);
  for (const limb of group.userData.limbs as AnimatedLimb[]) {
    limb.mesh.rotation.copy(limb.rest);
    if (!reducedMotion) limb.mesh.rotation[limb.axis] += Math.sin(time * (enemy.state === 'chase' ? 5 : 2.8) + limb.phase) * limb.gain * (enemy.state === 'frightened' ? 1.3 : 1);
  }
  const mat = group.userData.glow as THREE.MeshStandardMaterial;
  const color = returning ? '#c3e9ff' : enemy.state === 'frightened' ? '#70e6cd' : enemy.kind === 'Weeper' ? '#b5c6eb' : '#ed8459';
  mat.emissive.set(color); mat.color.set(color); mat.emissiveIntensity = enemy.state === 'chase' ? 2.7 : 1.8;
}
