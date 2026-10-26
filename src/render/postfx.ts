// Restrained full-scene effects, never over the DOM HUD/minimap. No motion blur,
// forced FOV, flashes or camera movement. Low quality bypasses the composer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Simulation } from '../game/simulation';
import type { Settings } from '../services/storage';

export class PostFX {
  readonly composer: EffectComposer;
  private bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .18, .3, .9);
  private grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: .012 }, fringe: { value: 0 }, vignette: { value: .15 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time,grain,fringe,vignette; varying vec2 vUv;
      void main(){vec2 d=vUv-.5; vec2 shift=d*dot(d,d)*fringe; vec3 c=texture2D(tDiffuse,vUv).rgb;
      c.r=texture2D(tDiffuse,clamp(vUv+shift,0.,1.)).r; c.b=texture2D(tDiffuse,clamp(vUv-shift,0.,1.)).b;
      float noise=fract(sin(dot(floor(vUv*1100.),vec2(12.9898,78.233))+time)*43758.5453)-.5;
      c*=1.-vignette*smoothstep(.1,.65,length(d)); c+=noise*grain; gl_FragColor=vec4(max(c,0.),1.); }`,
  });
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer); this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.bloom); this.composer.addPass(this.grade); this.composer.addPass(new OutputPass());
    this.renderer.info.autoReset = false;
  }
  resize(w: number, h: number) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  render(sim: Simulation, settings: Settings) {
    this.renderer.info.reset();
    if (settings.quality === 'low') { this.renderer.render(this.scene, this.camera); return; }
    const active = sim.enemies.filter(e => ['chase', 'scatter', 'frightened'].includes(e.state));
    const nearest = active.reduce((d, e) => Math.min(d, Math.hypot(e.position.x - sim.position.x, e.position.z - sim.position.z)), Infinity);
    const pressure = sim.overload > 0 ? 0 : Math.max(0, 1 - nearest / 10);
    this.grade.uniforms.time.value = settings.reducedMotion ? 0 : sim.time * 7;
    this.grade.uniforms.grain.value = settings.reducedMotion ? .004 : .012;
    this.grade.uniforms.fringe.value = settings.reducedMotion || settings.reducedScares ? 0 : pressure * .004;
    this.grade.uniforms.vignette.value = settings.reducedScares ? .08 : .12 + pressure * .12;
    this.bloom.strength = sim.overload > 0 ? .23 : .16;
    this.composer.render(0); // All animation is driven by paused-safe simulation time.
  }
  dispose() { for (const p of this.composer.passes) p.dispose(); this.composer.dispose(); }
  diagnostics() { return { grain: this.grade.uniforms.grain.value, fringe: this.grade.uniforms.fringe.value, effectTime: this.grade.uniforms.time.value }; }
}
