// Local ambientCG CC0 surfaces. Only color is sRGB; normals/roughness stay linear.
// One library owns shared GPU textures across topology rebuilds and chapter swaps.
import * as THREE from 'three';
import { surfaceTexture } from './textures';
export const SURFACES = { wall: 'Concrete023', floor: 'Tiles036', metal: 'Metal028' } as const;
type Surface = keyof typeof SURFACES;
export class MaterialLibrary {
  readonly ready: Promise<void>;
  readonly failures: string[] = [];
  private bases = new Map<string, THREE.Texture>();
  private variants = new Map<string, THREE.Texture>();
  private disposed = false;
  constructor() {
    const loader = new THREE.TextureLoader();
    this.ready = Promise.all(Object.values(SURFACES).flatMap(id => ['Color', 'NormalGL', 'Roughness'].map(async channel => {
      const path = `./assets/materials/${id}_1K-JPG_${channel}.jpg`;
      try {
        const texture = await loader.loadAsync(path);
        if (this.disposed) { texture.dispose(); return; }
        texture.colorSpace = channel === 'Color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
        texture.name = `${id}/${channel}`; texture.userData.persistent = true;
        this.bases.set(`${id}/${channel}`, texture);
      } catch { this.failures.push(path); }
    }))).then(() => {});
  }
  private texture(id: string, channel: string, repeat: [number, number]) {
    const base = this.bases.get(`${id}/${channel}`); if (!base) return null;
    const key = `${id}/${channel}/${repeat.join(',')}`;
    if (!this.variants.has(key)) {
      const texture = base.clone(); texture.repeat.set(...repeat); texture.needsUpdate = true;
      texture.userData.persistent = true; this.variants.set(key, texture);
    }
    return this.variants.get(key)!;
  }
  create(surface: Surface, levelId: string, repeat: [number, number] = [1, 1]) {
    const id = SURFACES[surface];
    const loaded = this.texture(id, 'Color', repeat);
    const material = new THREE.MeshStandardMaterial({
      map: loaded ?? surfaceTexture(surface === 'metal' ? 'ceiling' : surface, levelId),
      normalMap: this.texture(id, 'NormalGL', repeat), roughnessMap: this.texture(id, 'Roughness', repeat),
      normalScale: new THREE.Vector2(surface === 'floor' ? .38 : .65, surface === 'floor' ? .38 : .65),
      roughness: surface === 'floor' ? levelId === 'drainworks' ? .42 : .72 : .9,
      metalness: surface === 'metal' ? .65 : .03,
      color: surface === 'floor' ? '#514d46' : surface === 'metal' ? '#70635b' : levelId === 'drainworks' ? '#8a938e' : levelId === 'core' ? '#9b9187' : '#b4ac98',
    });
    if (!loaded && material.map) material.map.repeat.set(...repeat);
    material.name = `${surface}:${loaded ? id : 'procedural-fallback'}`;
    return material;
  }
  dispose() { this.disposed = true; this.bases.forEach(t => t.dispose()); this.variants.forEach(t => t.dispose()); this.bases.clear(); this.variants.clear(); }
}
