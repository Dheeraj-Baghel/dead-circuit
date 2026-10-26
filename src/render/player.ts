// User-supplied Luall_Studio model: actual skinned Eating clip, no placeholder.
// Game illustration only, not manufacturing CAD. All timing uses simulation
// time so pause/tab loss freezes the real jaw bones, not just a visual overlay.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_RADIUS } from '../game/movement';
import { CELL, type Point } from '../game/maze';
import type { Simulation } from '../game/simulation';
import type { Settings } from '../services/storage';
export const PLAYER_MODEL_SOURCE = {
  id: 'e5e8dfb614da4fa69182f252fa4274a8',
  url: 'https://sketchfab.com/3d-models/pacman-animated-e5e8dfb614da4fa69182f252fa4274a8',
  creator: 'Luall_Studio (luis_gustavo)', license: 'CC-BY-4.0', clip: 'Eating',
  sha256: '980059310ad27eef7637077d20788f1d1fad41605ae1d23bf072fceb5817e9f2',
} as const;
export const PLAYER_VISUAL_RADIUS = PLAYER_RADIUS - .025;

export class PlayerVisual {
  readonly root = new THREE.Group();
  readonly ready: Promise<void>;
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clip: THREE.AnimationClip | null = null;
  private skinned: THREE.SkinnedMesh[] = [];
  private bound: Simulation | null = null;
  private captures = -1; private time = 0; private animationTime = 0;
  private lastPosition: Point = { x: 0, z: 0 };
  private heading = 0; private moving = false; private disposed = false;
  private scale = 1; private sampledRadius = 0;
  private rawBounds = new THREE.Box3(); private triangles = 0; private samples = 0;
  private normalization = 'measuring';
  constructor(scene: THREE.Scene) {
    this.root.name = 'player:Pacman-animated'; this.root.visible = false; scene.add(this.root);
    this.ready = this.load();
  }
  private async load() {
    const response = await fetch('./assets/player/pacman_animated.glb');
    if (!response.ok) throw new Error('Player GLB unavailable.');
    const bytes = await response.arrayBuffer();
    let hash = '';
    if (globalThis.crypto?.subtle) hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    const asset = await new GLTFLoader().parseAsync(bytes, './assets/player/');
    this.model = asset.scene;
    this.clip = asset.animations.find(clip => clip.name === PLAYER_MODEL_SOURCE.clip) ?? null;
    if (!this.clip || !this.clip.tracks.some(t => t.name.endsWith('.quaternion'))) throw new Error('Uploaded player has no usable Eating bone animation.');
    this.model.traverse(o => {
      if (o instanceof THREE.SkinnedMesh) { this.skinned.push(o); this.triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; }
      if (o instanceof THREE.Mesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (material instanceof THREE.MeshStandardMaterial && material.color.getHexString() === 'ffcb00') {
          // Small fill keeps the yellow character readable in the dark maze;
          // no extra light, mesh replacement or modified animation tracks.
          material.emissive.set('#b77f00'); material.emissiveIntensity = .16; material.roughness = .57;
        }
      }
    });
    if (!this.skinned.length) throw new Error('Uploaded player has no skinned meshes.');
    this.mixer = new THREE.AnimationMixer(this.model); this.mixer.clipAction(this.clip).play();
    const times = new Set<number>([0, this.clip.duration]); for (const track of this.clip.tracks) for (const t of track.times) times.add(t);
    const vertex = new THREE.Vector3(); this.rawBounds.makeEmpty();
    // Measure real deformed vertices at every authored key time. Preserve the
    // rig's semantic XZ origin, and fit the full animated horizontal envelope
    // inside the EXISTING 560 mm diameter player collider, with 25 mm margin.
    if (hash === PLAYER_MODEL_SOURCE.sha256) {
      // This exact upload was measured at all 41 key times in the native Three
      // runtime (runtime-player.json). Reuse ONLY its SHA-verified envelope to
      // avoid expensive vertex rescans on every page load. Unknown bytes or
      // unavailable WebCrypto take the full measurement path below.
      this.sampledRadius = 117.2730640306846; this.samples = 41;
      this.rawBounds.min.set(-99.85092701587169, -18.37198866170551, -117.26062325790691);
      this.rawBounds.max.set(99.89606339455108, 201.3731976541203, 87.45783370243728);
      this.normalization = 'sha256-verified-measured-envelope';
    } else for (const time of [...times].sort((a, b) => a - b)) {
      this.mixer.setTime(Math.min(time, this.clip.duration - 1e-6)); this.model.updateMatrixWorld(true);
      for (const mesh of this.skinned) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        this.rawBounds.expandByPoint(vertex); this.sampledRadius = Math.max(this.sampledRadius, Math.hypot(vertex.x, vertex.z));
      }
      this.samples++;
      this.normalization = 'runtime-deformed-vertex-measurement';
    }
    if (!Number.isFinite(this.sampledRadius) || this.sampledRadius <= 0) throw new Error('Invalid player bounds.');
    this.scale = PLAYER_VISUAL_RADIUS / this.sampledRadius;
    this.mixer.setTime(0); this.model.scale.setScalar(this.scale); this.model.position.y = -this.rawBounds.min.y * this.scale + .02;
    // Native preview confirmed the supplied face points +Z. The game's forward
    // convention is -Z; rotate the complete rig, never its animation bones.
    this.model.rotation.y = Math.PI;
    this.root.add(this.model); this.root.visible = true;
    if (this.disposed) this.disposeModel();
  }
  update(sim: Simulation, rendered: Point, settings: Settings) {
    if (!this.model || !this.mixer || !this.clip) return;
    this.root.visible = settings.cameraMode === 'third';
    if (this.bound !== sim || (this.captures !== sim.captures && sim.safe)) {
      this.bound = sim; this.captures = sim.captures; this.time = sim.time; this.animationTime = 0;
      // Present the face on spawn/respawn so the real mouth cycle is visible.
      // The first actual translation turns the body into its movement direction;
      // idle then keeps that orientation while the user orbits the camera.
      this.lastPosition = { ...sim.position }; this.heading = sim.yaw + Math.PI; this.moving = false;
    }
    const dt = sim.time - this.time, dx = sim.position.x - this.lastPosition.x, dz = sim.position.z - this.lastPosition.z;
    if (dt > 0 && sim.mode === 'playing') {
      const distance = Math.hypot(dx, dz), teleported = distance > CELL * 1.5;
      this.moving = !teleported && distance > .0001;
      if (this.moving) this.heading = Math.atan2(-dx, -dz);
      this.animationTime += dt * (this.moving ? sim.sprinting ? 1.4 : 1 : settings.reducedMotion ? 0 : .25);
      this.time = sim.time; this.lastPosition = { ...sim.position };
    }
    this.mixer.setTime(this.animationTime); this.model.updateMatrixWorld(true);
    this.root.position.set(rendered.x, 0, rendered.z); this.root.rotation.y = this.heading;
  }
  diagnostics() {
    return { loaded: !!this.model && !!this.clip, visible: this.root.visible, clip: this.clip?.name ?? null, duration: this.clip?.duration ?? 0, animationTime: this.animationTime,
      heading: this.heading, moving: this.moving, scale: this.scale, triangles: this.triangles, sampledKeys: this.samples, sampledRadius: this.sampledRadius, normalization: this.normalization,
      visualRadius: this.scale * this.sampledRadius, collisionRadius: PLAYER_RADIUS, rawBounds: { min: this.rawBounds.min.toArray(), max: this.rawBounds.max.toArray() },
      position: this.root.position.toArray(), jaw: this.skinned[0]?.skeleton.bones.map(b => ({ name: b.name, rotation: b.quaternion.toArray() })) ?? [] };
  }
  private disposeModel() {
    if (!this.model) return;
    this.mixer?.stopAllAction(); this.mixer?.uncacheRoot(this.model);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
    this.model.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); } } if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton); });
    skeletons.forEach(s => s.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); this.model = null;
  }
  dispose() { this.disposed = true; this.disposeModel(); this.root.removeFromParent(); }
}
