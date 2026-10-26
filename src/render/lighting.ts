import * as THREE from 'three';
import type { Simulation } from '../game/simulation';
import type { Settings } from '../services/storage';
import { scareEnvelope, type ScareEvent } from '../game/atmosphere';

export const CHAPTER_LOOK = {
  service: { fog: '#14151a', ambient: '#8c95a9', ground: '#292018', lamp: '#e6bd82', accent: '#d6985c' },
  drainworks: { fog: '#10191d', ambient: '#849ba7', ground: '#18201b', lamp: '#87b8c6', accent: '#89c5cd' },
  core: { fog: '#1b1216', ambient: '#9c8e9b', ground: '#291a15', lamp: '#e0a27a', accent: '#ed9563' },
  training: { fog: '#141b1e', ambient: '#99a9b2', ground: '#24241c', lamp: '#c4d4bd', accent: '#9dd9bd' },
};
export const chapterLook = (id: string) => CHAPTER_LOOK[id as keyof typeof CHAPTER_LOOK] ?? CHAPTER_LOOK.service;
export function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d')!, image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = (x - 128) / 128, dy = (y - 128) / 128, r = Math.hypot(dx, dy);
    const centre = Math.exp(-r * r * 3.5), rim = .12 * Math.exp(-((r - .64) ** 2) / .009);
    const falloff = Math.max(0, 1 - r ** 4), scratch = 1 - .08 * Math.cos(Math.atan2(dy, dx) * 17 + r * 15);
    const value = Math.max(0, Math.min(255, (centre + rim) * falloff * scratch * 255));
    const i = (y * 256 + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); const texture = new THREE.CanvasTexture(c); texture.name = 'original-flashlight-cookie'; return texture;
}
export class LightingRig {
  readonly ambient = new THREE.HemisphereLight('#8c95a9', '#292018', .68);
  readonly flashlight = new THREE.SpotLight('#ffe3b2', 40, 27, .57, .85, 1.25);
  readonly practicals: THREE.PointLight[] = [];
  private target = new THREE.Object3D();
  private cookie = beamTexture();
  private ranked: { point: THREE.Vector3; d: number }[] = [];
  constructor(private scene: THREE.Scene, camera: THREE.Object3D) {
    this.scene.add(this.ambient);
    this.flashlight.position.set(.16, -.12, -.04); this.target.position.set(.12, -.1, -10);
    this.flashlight.castShadow = true; this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlight.shadow.bias = -.0002; this.flashlight.shadow.normalBias = .025;
    this.flashlight.map = this.cookie; this.flashlight.target = this.target;
    camera.add(this.flashlight, this.target);
    // Fixed shader light inventory. Color/intensity changes only; never toggle visible.
    for (let i = 0; i < 4; i++) { const light = new THREE.PointLight('#e6bd82', 16, 12, 1.55); this.practicals.push(light); scene.add(light); }
  }
  setLamps(lamps: THREE.Vector3[]) { this.ranked = lamps.map(point => ({ point, d: 0 })); }
  configure(settings: Settings) {
    this.flashlight.castShadow = settings.quality !== 'low'; this.flashlight.map = settings.quality === 'low' ? null : this.cookie;
  }
  update(sim: Simulation, camera: THREE.Camera, settings: Settings, scare: ScareEvent | null = null) {
    const look = chapterLook(sim.level.id);
    this.ambient.color.set(look.ambient); this.ambient.groundColor.set(look.ground); this.ambient.intensity = sim.blackout ? .28 : .62;
    (this.scene.background as THREE.Color).set(sim.blackout ? '#18090d' : look.fog);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(this.scene.background as THREE.Color); fog.density = sim.level.id === 'drainworks' ? .035 : .029;
    this.flashlight.intensity = sim.flashlight && !sim.blackout ? 26 : 0;
    this.flashlight.color.set(sim.overload > 0 ? '#b9f2df' : '#ffe3bd');
    for (const item of this.ranked) item.d = item.point.distanceToSquared(camera.position);
    this.ranked.sort((a, b) => a.d - b.d);
    const progress = sim.total ? sim.dotsEaten / sim.total : 0;
    const fadeLamp = scare?.kind === 'lamp' ? this.ranked.reduce<{ point: THREE.Vector3; d: number } | null>((best, item) => {
      const d = (item.point.x - scare.position.x) ** 2 + (item.point.z - scare.position.z) ** 2;
      return !best || d < best.d ? { point: item.point, d } : best;
    }, null)?.point : null;
    this.practicals.forEach((light, i) => {
      const lamp = this.ranked[i];
      if (!lamp) { light.intensity = 0; return; }
      light.position.copy(lamp.point); light.position.y -= .16;
      light.color.set(sim.blackout ? '#f15f4e' : look.lamp);
      // Gentle global dimming, not strobing. Motion preference removes variation.
      const breath = settings.reducedMotion ? 1 : .97 + Math.sin(sim.time * .22 + i * 1.5) * .03;
      light.intensity = (sim.blackout ? 13 : i === 0 ? 25 : 14) * (sim.blackout ? 1 : 1 - progress * .28) * breath;
      if (fadeLamp === lamp.point) light.intensity *= 1 - scareEnvelope(scare, sim.time) * .85;
    });
  }
  dispose() { this.cookie.dispose(); this.flashlight.shadow.map?.dispose(); this.practicals.forEach(l => { l.removeFromParent(); l.dispose(); }); this.flashlight.removeFromParent(); this.ambient.removeFromParent(); }
}
