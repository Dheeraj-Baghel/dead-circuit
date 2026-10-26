import * as THREE from 'three';
import { CELL, isWall, key, walkable, worldAt, type Cell, type Level } from '../game/levels';
import type { Simulation } from '../game/simulation';
import { createCreature, animateCreature } from './creature';
import { signTexture, grimeTexture } from './textures';
import { defaults, type Settings } from '../services/storage';
import { MaterialLibrary } from './materials';
import { LightingRig, chapterLook } from './lighting';
import { PostFX } from './postfx';
import { landmarkSites, NICHE, siteFaceKey } from './landmarks';
import { PropLibrary } from './props';
import { AtmosphereVisuals } from './atmosphere';
import type { ScareEvent } from '../game/atmosphere';
import { PlayerVisual } from './player';
import { chaseCamera } from './chaseCamera';

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
      if (!o.geometry.userData.persistent) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.userData.persistent) materials.add(m);
        for (const v of Object.values(m)) if (v instanceof THREE.Texture && !v.userData.persistent) textures.add(v);
      }
      if (o instanceof THREE.InstancedMesh) o.dispose();
    }
  });
  textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.clear();
}
const matrix = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const SIDES = [{ x: -1, z: 0, r: -Math.PI / 2 }, { x: 0, z: -1, r: Math.PI }, { x: 1, z: 0, r: Math.PI / 2 }, { x: 0, z: 1, r: 0 }];

// Rendering only. The unchanged maze graph remains collision/AI/map authority.
// Recessed landmarks remain wholly behind original player collision planes.
export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(74, 1, .06, 110);
  root = new THREE.Group(); actors = new THREE.Group();
  private atmosphere = new AtmosphereVisuals(this.scene);
  readonly ready: Promise<void>;
  private lighting: LightingRig;
  private player: PlayerVisual;
  private aim = new THREE.Object3D();
  private cameraFraction = 1;
  private fx: PostFX;
  private materials = new MaterialLibrary();
  private props = new PropLibrary();
  private observer: ResizeObserver;
  private motes: THREE.InstancedMesh | null = null;
  private charges: THREE.Group[] = [];
  private creatures: THREE.Group[] = [];
  private boundSimulation: Simulation | null = null;
  private pickupState = ''; private currentLevel = ''; private topology = '';
  private relayMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private exitMaterial!: THREE.MeshStandardMaterial;
  private fixtureMaterial!: THREE.MeshStandardMaterial;
  private relicMesh: THREE.Mesh | null = null;
  private dust: THREE.Points | null = null;
  private shafts: THREE.InstancedMesh | null = null;
  private settings = defaults(); private disposed = false;
  private landmarkCount = 0;
  private landmarkFit: { kind: string; insideWall: boolean; size: number[] }[] = [];
  get flashlight() { return this.lighting.flashlight; }
  constructor(private canvas: HTMLCanvasElement, level: Level) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#14151a'); this.scene.fog = new THREE.FogExp2('#14151a', .029);
    this.scene.add(this.root, this.actors, this.camera, this.aim);
    this.lighting = new LightingRig(this.scene, this.aim); this.player = new PlayerVisual(this.scene);
    this.fx = new PostFX(this.renderer, this.scene, this.camera);
    this.build(level); this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
    this.ready = Promise.all([this.materials.ready, this.props.ready, this.player.ready]).then(() => {
      if (!this.disposed) this.build(this.boundSimulation?.level ?? level);
    });
  }
  configure(settings: Settings) {
    const qualityChanged = settings.quality !== this.settings.quality;
    this.settings = settings; this.lighting.configure(settings);
    if (qualityChanged) { this.renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'low' ? .85 : 1.25)); this.resize(); }
    this.updateFov();
  }
  private updateFov() { this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.settings.fov) / 2) / this.camera.aspect)); this.camera.updateProjectionMatrix(); }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.updateFov(); this.fx.resize(w, h);
  }
  private instances(geo: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], shadows = false) {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length); matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = shadows; mesh.receiveShadow = shadows; mesh.computeBoundingSphere(); this.root.add(mesh); return mesh;
  }
  private wallSign(level: Level, cell: Cell, title: string, subtitle: string, color = '#dec994') {
    const side = SIDES.find(d => isWall(level, cell.x + d.x, cell.z + d.z)); if (!side) return;
    const p = worldAt(cell), texture = signTexture(title, subtitle, color);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .56), new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#b8ac91', emissiveIntensity: .19, roughness: .75 }));
    // The normal points back into the corridor, not into the wall.
    mesh.position.set(p.x + side.x * (CELL / 2 - .025), 2.3, p.z + side.z * (CELL / 2 - .025)); mesh.rotation.y = side.r + Math.PI; this.root.add(mesh);
  }
  private build(level: Level) {
    disposeTree(this.root); this.currentLevel = level.id; this.topology = level.grid.join(''); this.relayMaterials.clear();
    const look = chapterLook(level.id), sites = landmarkSites(level), niches = new Map(sites.map(s => [siteFaceKey(s), s])); this.landmarkCount = sites.length;
    const wallMaterial = this.materials.create('wall', level.id, [1, 1.23]);
    const metal = this.materials.create('metal', level.id); metal.color.set(level.id === 'drainworks' ? '#3a5058' : level.id === 'core' ? '#4c3840' : '#3f4149'); metal.metalness = .25;
    const faces: THREE.Matrix4[] = [], lower: THREE.Matrix4[] = [], grime: THREE.Matrix4[] = [], pipes: THREE.Matrix4[] = [], baseboards: THREE.Matrix4[] = [], fixtures: THREE.Matrix4[] = [], lampBoxes: THREE.Matrix4[] = [], lamps: THREE.Vector3[] = [];
    for (let z = 0; z < level.height; z++) for (let x = 0; x < level.width; x++) {
      if (isWall(level, x, z, 'hunter')) {
        for (const side of SIDES) {
          if (isWall(level, x + side.x, z + side.z, 'hunter')) continue;
          const px = (x + .5 + side.x * .5) * CELL, pz = (z + .5 + side.z * .5) * CELL;
          const base = matrix(px, 0, pz, 0, side.r);
          const plane = (w: number, h: number, lx: number, y: number, lz: number, ry = 0, rx = 0) => faces.push(base.clone().multiply(matrix(lx, y, lz, rx, ry, 0, w, h)));
          const niche = niches.get(`${x},${z}/${side.x},${side.z}`);
          if (niche) {
            const w = NICHE.width, h = NICHE.height, d = NICHE.depth, jamb = (CELL - w) / 2;
            plane(jamb, 3.44, -(w + jamb) / 2, 1.72, 0); plane(jamb, 3.44, (w + jamb) / 2, 1.72, 0);
            plane(w, 3.44 - h, 0, (3.44 + h) / 2, 0); plane(w, h, 0, h / 2, -d);
            plane(d, h, -w / 2, h / 2, -d / 2, Math.PI / 2); plane(d, h, w / 2, h / 2, -d / 2, -Math.PI / 2);
            plane(w, d, 0, h, -d / 2, 0, Math.PI / 2); plane(w, d, 0, .005, -d / 2, 0, -Math.PI / 2);
          } else {
            plane(CELL, 3.44, 0, 1.72, 0);
            lower.push(base.clone().multiply(matrix(0, .61, .004, 0, 0, 0, CELL, 1.22)));
            if ((x * 7 + z * 11) % 3 !== 0) grime.push(base.clone().multiply(matrix(0, 1.72, .009, 0, 0, 0, CELL, 3.44)));
          }
          pipes.push(base.clone().multiply(matrix(0, 2.93, .065, 0, 0, Math.PI / 2)));
          baseboards.push(base.clone().multiply(matrix(0, .12, .025)));
        }
      } else if ((x + z) % 4 === 0 && !['H', '-'].includes(level.grid[z][x])) {
        const p = new THREE.Vector3((x + .5) * CELL, 3.12, (z + .5) * CELL); lamps.push(p);
        fixtures.push(matrix(p.x, p.y, p.z)); lampBoxes.push(matrix(p.x, p.y + .045, p.z));
      }
    }
    this.instances(new THREE.PlaneGeometry(1, 1), wallMaterial, faces, true);
    this.instances(new THREE.PlaneGeometry(1, 1), metal, lower, true);
    this.instances(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: grimeTexture(), transparent: true, roughness: 1, depthWrite: false }), grime);
    this.instances(new THREE.CylinderGeometry(.038, .038, CELL, 6), new THREE.MeshStandardMaterial({ color: '#756757', roughness: .65, metalness: .55 }), pipes);
    this.instances(new THREE.BoxGeometry(CELL, .24, .06), new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: .85 }), baseboards);
    this.fixtureMaterial = new THREE.MeshStandardMaterial({ color: look.lamp, emissive: look.lamp, emissiveIntensity: 1.9 });
    const fixtureMesh = this.instances(new THREE.BoxGeometry(1.05, .045, .16), this.fixtureMaterial, fixtures);
    this.instances(new THREE.BoxGeometry(1.22, .14, .29), new THREE.MeshStandardMaterial({ color: '#3b3b3e', metalness: .45, roughness: .65 }), lampBoxes);
    const floorMaterial = this.materials.create('floor', level.id, [level.width / 2, level.height / 2]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(level.width * CELL, level.height * CELL), floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.set(level.width * CELL / 2, 0, level.height * CELL / 2); floor.receiveShadow = true; this.root.add(floor);
    const ceilingMaterial = this.materials.create('metal', level.id, [level.width, level.height]); ceilingMaterial.color.set('#292b30');
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(level.width * CELL, level.height * CELL), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; ceiling.position.copy(floor.position); ceiling.position.y = 3.44; this.root.add(ceiling);
    this.landmarkFit = sites.map(site => {
      const prop = this.props.create(site); this.root.add(prop); prop.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(prop), eps = .001;
      const insideWall = bounds.min.x >= site.wall.x * CELL - eps && bounds.max.x <= (site.wall.x + 1) * CELL + eps && bounds.min.z >= site.wall.z * CELL - eps && bounds.max.z <= (site.wall.z + 1) * CELL + eps;
      return { kind: site.kind, insideWall, size: bounds.getSize(new THREE.Vector3()).toArray() };
    });
    this.lighting.setLamps(lamps);
    // Thin service frames on corridor walls are instanced; the aisle is unchanged.
    if (level.lockup) {
      const p = worldAt(level.lockup.door), bars: THREE.Matrix4[] = [];
      for (let i = 0; i < 15; i++) bars.push(matrix(p.x - CELL / 2 + i * CELL / 14, 1.72, p.z - CELL / 2));
      for (const y of [.2, 1.65, 3.2]) bars.push(matrix(p.x, y, p.z - CELL / 2, 0, 0, Math.PI / 2));
      this.instances(new THREE.CylinderGeometry(.018, .018, 3.4, 4), this.materials.create('metal', level.id), bars, true);
      this.wallSign(level, level.lockup.outside, 'LOCKUP', 'DO NOT APPROACH', '#e8997b');
      const red = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#df624c', emissive: '#df624c', emissiveIntensity: 2.8 }));
      red.position.set(p.x, 3.28, p.z - CELL / 2 + .08); this.root.add(red);
    }
    if (level.tunnelRow !== undefined) {
      const z = (level.tunnelRow + .5) * CELL, material = this.materials.create('metal', level.id);
      for (const x of [-CELL * 2, level.width * CELL]) {
        const extension = new THREE.Mesh(new THREE.BoxGeometry(CELL * 2, .1, CELL), material); extension.position.set(x + CELL, -.05, z); extension.receiveShadow = true; this.root.add(extension);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(CELL * 2, .12, CELL), material); roof.position.set(x + CELL, 3.44, z); this.root.add(roof);
        for (const dz of [-CELL / 2, CELL / 2]) { const side = new THREE.Mesh(new THREE.BoxGeometry(CELL * 2, 3.44, .1), material); side.position.set(x + CELL, 1.72, z + dz); this.root.add(side); }
      }
      this.wallSign(level, { x: 2, z: level.tunnelRow }, 'LINK / A', 'PAIRED SERVICE TUNNEL');
      this.wallSign(level, { x: level.width - 3, z: level.tunnelRow }, 'LINK / B', 'PAIRED SERVICE TUNNEL');
    }
    const cells = walkable(level);
    // Flat steel slats visually match the metallic tunnel footstep treatment.
    const grates: THREE.Matrix4[] = [];
    for (const c of cells.filter(c => c.z === level.tunnelRow)) for (let i = 0; i < 8; i++) grates.push(matrix((c.x + .5) * CELL, .012, (c.z + (i + .5) / 8) * CELL));
    this.instances(new THREE.BoxGeometry(CELL * .98, .012, .035), new THREE.MeshStandardMaterial({ color: '#4c5e63', metalness: .55, roughness: .65 }), grates);
    const marks = cells.filter((c, i) => i % 7 === 0).map(c => matrix((c.x + .5) * CELL, .009, (c.z + .5) * CELL));
    this.instances(new THREE.BoxGeometry(.045, .008, .65), new THREE.MeshStandardMaterial({ color: '#ac8753', roughness: .95 }), marks);
    const start = worldAt(level.start), exit = worldAt(level.exit);
    const refuge = new THREE.Mesh(new THREE.RingGeometry(.68, .74, 32), new THREE.MeshBasicMaterial({ color: '#91b8bd', transparent: true, opacity: .5 }));
    refuge.rotation.x = -Math.PI / 2; refuge.position.set(start.x, .014, start.z); this.root.add(refuge);
    this.exitMaterial = new THREE.MeshStandardMaterial({ color: '#b98d4e', emissive: '#a65d24', emissiveIntensity: .7 });
    const exitRing = new THREE.Mesh(new THREE.RingGeometry(.62, .79, 4), this.exitMaterial); exitRing.rotation.x = -Math.PI / 2; exitRing.position.set(exit.x, .017, exit.z); this.root.add(exitRing);
    this.wallSign(level, level.start, 'REFUGE', 'SIGNAL SHIELDED', '#a0c9bc'); this.wallSign(level, level.exit, 'EXIT / LIFT', 'RESTORE ALL MEMORY');
    for (const c of level.relays) {
      const p = worldAt(c), material = new THREE.MeshStandardMaterial({ color: '#dbb278', emissive: '#d2a157', emissiveIntensity: .6 }); this.relayMaterials.set(key(c), material);
      const relay = new THREE.Mesh(new THREE.BoxGeometry(.5, .26, .5), material); relay.position.set(p.x, 2.91, p.z); this.root.add(relay);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.46, .5, 4), material); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, .016, p.z); this.root.add(ring);
    }
    for (const [i, c] of cells.filter(c => (c.x * 7 + c.z * 11) % 29 === 0).entries()) this.wallSign(level, c, `${level.number} / ${String(i + 1).padStart(2, '0')}`, i % 2 ? 'MAINTENANCE' : 'SIGNAL SECTOR', look.accent);
    // Ceiling cable bundles/pipe bridges use 2580+ mm clearance above player.
    const conduits: THREE.Matrix4[] = [];
    for (const c of cells.filter(c => c.x % 4 === 1 && c.z % 4 === 3)) for (const offset of [-.11, 0, .11]) conduits.push(matrix((c.x + .5) * CELL + offset, 2.8, (c.z + .5) * CELL, Math.PI / 2));
    this.instances(new THREE.CylinderGeometry(level.id === 'drainworks' ? .09 : .024, level.id === 'drainworks' ? .09 : .024, CELL, 5), new THREE.MeshStandardMaterial({ color: level.id === 'drainworks' ? '#4b6570' : '#2b292e', roughness: .7, metalness: .3 }), conduits);
    if (level.id === 'core') {
      const machine = new THREE.Mesh(new THREE.CylinderGeometry(.72, .46, .48, 12), this.materials.create('metal', level.id)); machine.position.set(10.5 * CELL, 3.16, 10.5 * CELL); this.root.add(machine);
      const coil = new THREE.Mesh(new THREE.TorusGeometry(.8, .04, 6, 32), new THREE.MeshStandardMaterial({ color: '#e6a27c', emissive: '#df7546', emissiveIntensity: 2 })); coil.rotation.x = Math.PI / 2; coil.position.copy(machine.position); this.root.add(coil);
    }
    // Decal-like damp pools are <= 10 mm high and don't change contact geometry.
    const pools = cells.filter(c => (c.x * 3 + c.z * 7) % (level.id === 'drainworks' ? 9 : 23) === 0).map(c => matrix((c.x + .5) * CELL + .3, .006, (c.z + .5) * CELL, -Math.PI / 2, 0, c.x, 1, .45, 1));
    this.instances(new THREE.CircleGeometry(.7, 12), new THREE.MeshStandardMaterial({ color: '#17212a', roughness: .12, metalness: .25, transparent: true, opacity: .48, depthWrite: false }), pools);
    const dust = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) { const c = cells[(i * 17) % cells.length]; dust[i * 3] = (c.x + .2 + (i * .13 % .6)) * CELL; dust[i * 3 + 1] = .25 + i * .173 % 2.7; dust[i * 3 + 2] = (c.z + .3) * CELL; }
    this.dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dust, 3)), new THREE.PointsMaterial({ color: '#c0b49d', size: .018, transparent: true, opacity: .25, depthWrite: false })); this.root.add(this.dust);
    this.shafts = this.instances(new THREE.CylinderGeometry(.05, .48, 1.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: look.lamp, transparent: true, opacity: .018, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), lamps.slice(0, 18).map(p => matrix(p.x, p.y - .77, p.z)));
    this.atmosphere.bind(this.root, fixtureMesh, lamps);
  }
  private bind(sim: Simulation) {
    if (this.currentLevel !== sim.level.id || this.topology !== sim.level.grid.join('')) this.build(sim.level);
    disposeTree(this.actors); this.boundSimulation = sim; this.pickupState = '';
    this.motes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.095, 0), new THREE.MeshStandardMaterial({ color: '#ffd990', emissive: '#e6aa47', emissiveIntensity: 2 }), sim.pickups.length); this.actors.add(this.motes);
    this.charges = sim.pickups.filter(p => p.kind === 'charge').map(p => {
      const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#97edcf', emissive: '#5cddc0', emissiveIntensity: 2 });
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.2), mat)); const ring = new THREE.Mesh(new THREE.TorusGeometry(.31, .014, 4, 24), mat); ring.rotation.x = .8; g.add(ring);
      g.position.set(p.position.x, .85, p.position.z); this.actors.add(g); return g;
    });
    this.creatures = sim.enemies.map(e => { const g = createCreature(e.kind); this.actors.add(g); return g; });
    this.relicMesh = new THREE.Mesh(new THREE.TorusGeometry(.25, .08, 6, 16), new THREE.MeshStandardMaterial({ color: '#e8d795', emissive: '#e8a15d', emissiveIntensity: 1.5 })); this.actors.add(this.relicMesh);
  }
  render(sim: Simulation, alpha = 1, scare: ScareEvent | null = null) {
    if (this.boundSimulation !== sim) this.bind(sim); if (this.topology !== sim.level.grid.join('')) this.build(sim.level);
    const state = sim.pickups.map(p => p.collected ? '1' : '0').join('');
    if (state !== this.pickupState && this.motes) {
      const m = new THREE.Matrix4(); sim.pickups.forEach((p, i) => { const s = p.collected || p.kind === 'charge' ? 0 : 1; m.makeScale(s, s, s); m.setPosition(p.position.x, .31, p.position.z); this.motes!.setMatrixAt(i, m); });
      this.motes.instanceMatrix.needsUpdate = true; this.motes.computeBoundingSphere(); this.pickupState = state;
    }
    sim.pickups.filter(p => p.kind === 'charge').forEach((p, i) => { this.charges[i].visible = !p.collected; this.charges[i].rotation.y = this.settings.reducedMotion ? 0 : sim.time * .8; });
    sim.enemies.forEach((e, i) => animateCreature(this.creatures[i], e, sim.time, this.settings.reducedMotion));
    if (this.relicMesh) { this.relicMesh.visible = !!sim.relic; if (sim.relic) { this.relicMesh.position.set(sim.relic.position.x, .8, sim.relic.position.z); this.relicMesh.rotation.y = this.settings.reducedMotion ? 0 : sim.time; } }
    const blend = sim.mode === 'playing' ? Math.max(0, Math.min(1, alpha)) : 1;
    const rendered = { x: THREE.MathUtils.lerp(sim.previous.x, sim.position.x, blend), z: THREE.MathUtils.lerp(sim.previous.z, sim.position.z, blend) };
    this.player.update(sim, rendered, this.settings);
    if (this.settings.cameraMode === 'third') {
      const placement = chaseCamera(sim.level, rendered, sim.yaw, sim.pitch); this.cameraFraction = placement.fraction;
      this.camera.position.set(placement.eye.x, placement.eye.y, placement.eye.z); this.camera.lookAt(placement.target.x, placement.target.y, placement.target.z);
    } else {
      this.cameraFraction = 1; this.camera.position.set(rendered.x, 1.62, rendered.z);
      this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(sim.pitch, sim.yaw, 0);
    }
    // The flashlight stays at the player's aim, not behind the visible body,
    // so the actor cannot shadow out its own forward navigation beam.
    this.aim.position.set(rendered.x, this.settings.cameraMode === 'third' ? 1.12 : 1.62, rendered.z); this.aim.rotation.order = 'YXZ'; this.aim.rotation.set(sim.pitch, sim.yaw, 0);
    this.lighting.update(sim, this.camera, this.settings, scare);
    this.fixtureMaterial.emissive.set(sim.blackout ? '#c94535' : chapterLook(sim.level.id).lamp); this.fixtureMaterial.emissiveIntensity = sim.blackout ? .5 : 1.5;
    this.exitMaterial.emissive.set(sim.exitOpen ? '#86d0b8' : '#a65d24');
    this.relayMaterials.forEach((m, id) => m.emissive.set(sim.relays.has(id) ? '#80c6b1' : '#bb7e37'));
    if (this.shafts) this.shafts.visible = this.settings.quality !== 'low' && !sim.blackout;
    if (this.dust) { this.dust.visible = this.settings.quality !== 'low'; this.dust.position.y = this.settings.reducedMotion ? 0 : Math.sin(sim.time * .13) * .06; }
    this.atmosphere.update(scare, sim.time);
    this.fx.render(sim, this.settings);
  }
  diagnostics() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
    landmarks: this.landmarkCount, landmarkFit: this.landmarkFit, materials: this.materials.failures.length ? 'fallback' : 'local-pbr', assetFailures: [...this.materials.failures, ...this.props.failures], postfx: this.settings.quality !== 'low', cookie: !!this.flashlight.map,
    fx: this.fx.diagnostics(), lights: this.lighting.practicals.length + 1, atmosphere: this.atmosphere.diagnostics(), player: this.player.diagnostics(), camera: { mode: this.settings.cameraMode, position: this.camera.position.toArray(), fraction: this.cameraFraction },
    creatures: this.creatures.map(g => ({ name: g.name, silhouette: g.userData.silhouette, meshes: g.children.length })) }; }
  dispose() { this.disposed = true; this.observer.disconnect(); disposeTree(this.root); disposeTree(this.actors); this.player.dispose(); this.atmosphere.dispose(); this.fx.dispose(); this.lighting.dispose(); this.materials.dispose(); this.props.dispose(); this.renderer.dispose(); }
}
