import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NICHE, type Landmark } from './landmarks';
import { signTexture } from './textures';
import { CELL, worldAt } from '../game/maze';

export class PropLibrary {
  readonly ready: Promise<void>;
  readonly failures: string[] = [];
  private models = new Map<string, THREE.Group>();
  private disposed = false;
  constructor() {
    const loader = new GLTFLoader();
    this.ready = Promise.all(['arcade-machine', 'claw-machine', 'ticket-machine', 'prizes'].map(async name => {
      try {
        const asset = await loader.loadAsync(`./assets/arcade/${name}.glb`);
        const root = asset.scene;
        root.traverse(o => { if (o instanceof THREE.Mesh) {
          o.geometry.userData.persistent = true;
          for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
            mat.userData.persistent = true;
            if (mat instanceof THREE.MeshStandardMaterial) { mat.color.multiply(new THREE.Color('#9c958b')); mat.roughness = .88; mat.metalness = .12; }
            for (const v of Object.values(mat)) if (v instanceof THREE.Texture) { v.userData.persistent = true; v.colorSpace = THREE.SRGBColorSpace; }
          }
        } });
        this.models.set(name, root);
      } catch { this.failures.push(name); }
    })).then(() => { if (this.disposed) this.disposeModels(); });
  }
  create(site: Landmark) {
    const group = new THREE.Group(); group.name = `landmark:${site.kind}`;
    const prototype = this.models.get(site.kind);
    if (prototype) {
      const model = prototype.clone(true), bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
      const scale = Math.min(1.96 / size.y, 1.8 / size.x, 1.55 / size.z);
      model.scale.setScalar(scale);
      // Model faces local +Z. Front stays 80 mm behind the original wall plane.
      model.position.set(-(bounds.min.x + bounds.max.x) * .5 * scale, -bounds.min.y * scale + .035, -.08 - bounds.max.z * scale);
      group.add(model);
    } else this.procedural(group, site.kind);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.75, .28), new THREE.MeshStandardMaterial({ map: signTexture(site.title, 'SUBLEVEL / AUTHORIZED STAFF', '#d9a876'), emissive: '#dcb788', emissiveIntensity: .12, roughness: .8 }));
    sign.position.set(0, 2.35, -.04); group.add(sign);
    // Original screens cover only the panel of a cabinet, never third-party
    // franchise imagery. Idle scan lines are static under reduced motion.
    if (site.kind === 'arcade-machine' || site.kind === 'ticket-machine') {
      const texture = signTexture('NO SIGNAL', 'INSERT MEMORY', '#8fcbbe');
      const mat = new THREE.MeshBasicMaterial({ map: texture, color: '#527364', toneMapped: false });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(.64, .4), mat); screen.name = 'original-cabinet-screen'; screen.position.set(0, 1.39, -.065); group.add(screen);
    }
    const p = worldAt(site.wall); group.position.set(p.x + site.dx * CELL / 2, 0, p.z + site.dz * CELL / 2); group.rotation.y = site.rotation;
    group.userData.recessed = true; group.userData.wall = site.wall;
    return group;
  }
  private procedural(group: THREE.Group, kind: Landmark['kind']) {
    const geometries: THREE.BufferGeometry[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => geometries.push(new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x, y, z));
    const steel = new THREE.MeshStandardMaterial({ color: '#3d4548', roughness: .7, metalness: .5 });
    const glow = new THREE.MeshStandardMaterial({ color: '#d5a16e', emissive: '#b85d2e', emissiveIntensity: .7, roughness: .5 });
    if (kind === 'tank') {
      geometries.push(new THREE.CylinderGeometry(.53, .53, 1.85, 16).toNonIndexed().translate(0, 1, -.85));
      for (const y of [.25, 1.7]) geometries.push(new THREE.TorusGeometry(.54, .035, 5, 20).toNonIndexed().rotateX(Math.PI / 2).translate(0, y, -.85));
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .07, 12), glow); dial.rotation.x = Math.PI / 2; dial.position.set(0, 1.5, -.28); group.add(dial);
    } else {
      const lockers = kind === 'locker';
      box(1.6, 2.05, .48, 0, 1.03, -.43);
      for (let i = 0; i < (lockers ? 3 : 2); i++) {
        const x = (i - (lockers ? 1 : .5)) * (lockers ? .51 : .7);
        box(.025, 1.96, .04, x - .24, 1.03, -.17);
        for (let j = 0; j < 4; j++) box(.25, .015, .025, x, 1.7 - j * .08, -.17);
        box(.025, .13, .035, x + .13, 1.04, -.14);
      }
      if (!lockers) for (let i = 0; i < 6; i++) { const led = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .02), glow); led.position.set(-.5 + (i % 3) * .45, .7 + Math.floor(i / 3) * .3, -.17); group.add(led); }
    }
    const geo = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    if (geo) group.add(new THREE.Mesh(geo, steel));
  }
  private disposeModels() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.models.forEach(root => root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v); } } }));
    textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); this.models.clear();
  }
  dispose() { this.disposed = true; this.disposeModels(); }
}
