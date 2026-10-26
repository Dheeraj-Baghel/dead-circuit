import * as THREE from 'three';
import { scareEnvelope, type ScareEvent } from '../game/atmosphere';

// Lightweight cosmetic actors, never simulation enemies or collision objects.
// One slow lamp fade, one screen fade, or a distant translucent silhouette.
export class AtmosphereVisuals {
  private group = new THREE.Group();
  private silhouette = new THREE.Group();
  private shadowMaterial = new THREE.MeshBasicMaterial({ color: '#080b13', transparent: true, opacity: 0, depthWrite: false });
  private lampMaterial = new THREE.MeshStandardMaterial({ color: '#e6bd82', emissive: '#e6bd82', emissiveIntensity: 1.5 });
  private lamp = new THREE.Mesh(new THREE.BoxGeometry(1.05, .045, .16), this.lampMaterial);
  private fixtures: THREE.InstancedMesh | null = null;
  private lamps: THREE.Vector3[] = [];
  private matrices: THREE.Matrix4[] = [];
  private hiddenIndex = -1;
  private screens: { mesh: THREE.Mesh; color: THREE.Color; position: THREE.Vector3 }[] = [];
  private current: string | null = null;
  constructor(scene: THREE.Scene) {
    this.group.name = 'cosmetic-atmosphere'; this.silhouette.name = 'cosmetic-shadow-not-a-hunter';
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.19, .36, 1.5, 7), this.shadowMaterial); body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 7), this.shadowMaterial); head.position.y = 1.99;
    this.silhouette.add(body, head); this.group.add(this.silhouette, this.lamp); scene.add(this.group);
    this.lamp.visible = false; this.silhouette.visible = false;
  }
  bind(root: THREE.Group, fixtures: THREE.InstancedMesh, lamps: THREE.Vector3[]) {
    this.fixtures = fixtures; this.lamps = lamps; this.matrices = lamps.map((_, i) => { const m = new THREE.Matrix4(); fixtures.getMatrixAt(i, m); return m; }); this.hiddenIndex = -1;
    this.screens = [];
    root.updateMatrixWorld(true);
    root.traverse(o => { if (o instanceof THREE.Mesh && o.name === 'original-cabinet-screen' && o.material instanceof THREE.MeshBasicMaterial) this.screens.push({ mesh: o, color: o.material.color.clone(), position: o.getWorldPosition(new THREE.Vector3()) }); });
  }
  update(event: ScareEvent | null, time: number) {
    this.current = event?.kind ?? null; const envelope = scareEnvelope(event, time);
    this.lamp.visible = false; this.silhouette.visible = false;
    this.screens.forEach(s => (s.mesh.material as THREE.MeshBasicMaterial).color.copy(s.color));
    let lampIndex = -1;
    if (event?.kind === 'lamp' && this.lamps.length) {
      lampIndex = this.lamps.reduce((best, p, i) => p.distanceToSquared(new THREE.Vector3(event.position.x, 3.12, event.position.z)) < this.lamps[best].distanceToSquared(new THREE.Vector3(event.position.x, 3.12, event.position.z)) ? i : best, 0);
    }
    if (this.hiddenIndex !== lampIndex && this.fixtures) {
      if (this.hiddenIndex >= 0) this.fixtures.setMatrixAt(this.hiddenIndex, this.matrices[this.hiddenIndex]);
      if (lampIndex >= 0) this.fixtures.setMatrixAt(lampIndex, new THREE.Matrix4().makeScale(0, 0, 0));
      this.fixtures.instanceMatrix.needsUpdate = true; this.hiddenIndex = lampIndex;
    }
    if (lampIndex >= 0) { this.lamp.visible = true; this.lamp.position.copy(this.lamps[lampIndex]); this.lampMaterial.emissiveIntensity = 1.5 * (1 - envelope * .85); }
    if (event?.kind === 'screen' && this.screens.length) {
      const target = new THREE.Vector3(event.position.x, 1.4, event.position.z);
      const screen = this.screens.reduce((best, s) => s.position.distanceToSquared(target) < best.position.distanceToSquared(target) ? s : best);
      (screen.mesh.material as THREE.MeshBasicMaterial).color.copy(screen.color).lerp(new THREE.Color('#c6f5e0'), envelope * .85);
    }
    if (event?.kind === 'silhouette') {
      const phase = Math.max(0, Math.min(1, (time - event.start) / event.duration));
      this.silhouette.visible = true; this.silhouette.position.set(event.position.x + (phase - .5) * 1.2, 0, event.position.z);
      this.shadowMaterial.opacity = envelope * .6;
    }
  }
  diagnostics() { return { kind: this.current, silhouette: this.silhouette.visible, lamp: this.lamp.visible, lampIndex: this.hiddenIndex }; }
  dispose() { this.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); this.lampMaterial.dispose(); this.shadowMaterial.dispose(); this.group.removeFromParent(); }
}
