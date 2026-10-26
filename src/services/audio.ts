import type { Simulation, GameEvent } from '../game/simulation';
import type { ScareEvent } from '../game/atmosphere';
import type { Settings } from './storage';
import { AUDIO_FILES, chapterMix, directionCaption, HUNTER_CAPTION, hunterSound, surfaceAt, threatPressure, type Sample, type SoundCaption } from './soundModel';
import type { Point } from '../game/maze';

type Voice = { group: string; priority: number; cleanup: () => void; stop: () => void };
type Options = { group?: string; priority?: number; position?: Point; cutoff?: number; rate?: number; delay?: number };
// Native Web Audio, activated only by Play/Resume. Eight small local CC0 samples
// add texture; ambience/music/heartbeat/wordless cries are original synthesis.
// All cue decisions use simulation time. Pause stops transients and suspends the
// native context (including loop phases); no wall-clock timers or cue backlog.
export class AudioEngine {
  context: AudioContext | null = null;
  captions: SoundCaption[] = [];
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private duck: GainNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private machine: OscillatorNode | null = null;
  private meter: AnalyserNode | null = null;
  private drones: OscillatorNode[] = [];
  private loops: AudioScheduledSourceNode[] = [];
  private voices = new Set<Voice>();
  private raw = new Map<Sample, ArrayBuffer>();
  private buffers = new Map<Sample, AudioBuffer>();
  private noiseBuffer: AudioBuffer | null = null;
  private load: Promise<void> | null = null;
  private decoding: Promise<void> | null = null;
  private abort = new AbortController();
  private failures = new Set<string>();
  private active = false; private disposed = false;
  private bound: Simulation | null = null; private captures = -1;
  private settings: Settings | null = null;
  private lastSpatial = -10; private nextHeartbeat = 0;
  private nextHunter = new Map<number, number>();
  private nextDrip = 0; private stepIndex = 0; private lastScare = 0; private wasPowered = false;
  private priorityUntil = 0; private fallbackCount = 0; private started = 0;
  private lastSurface = 'tile'; private peakVoices = 0;
  preload(): Promise<void> {
    if (this.load) return this.load;
    this.load = Promise.all((Object.entries(AUDIO_FILES) as [Sample, string][]).map(async ([id, file]) => {
      try {
        const response = await fetch(`./assets/audio/${file}`, { signal: this.abort.signal });
        if (!response.ok) throw new Error('sample unavailable'); const bytes = await response.arrayBuffer();
        if (!this.disposed) this.raw.set(id, bytes);
      } catch { if (!this.disposed) this.failures.add(file); }
    })).then(() => {}); return this.load;
  }
  bind(sim: Simulation) {
    if (this.bound === sim && this.captures === sim.captures) return;
    this.stopVoices(); this.bound = sim; this.captures = sim.captures;
    this.captions = []; this.lastSpatial = -10; this.nextHeartbeat = sim.time;
    this.nextHunter.clear(); this.nextDrip = sim.time + 2; this.stepIndex = 0; this.lastScare = 0; this.wasPowered = false; this.priorityUntil = 0;
  }
  async activate(settings: Settings, sim?: Simulation) {
    if (this.disposed) return;
    this.settings = settings; if (sim) this.bind(sim);
    if (!this.context) this.createGraph();
    this.active = true; await this.context!.resume();
    if (!this.active || this.disposed) return;
    this.configure(settings); void this.decodeSamples();
  }
  private createGraph() {
    const ctx = new AudioContext({ latencyHint: 'interactive' }); this.context = ctx;
    const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.knee.value = 10; compressor.ratio.value = 5; compressor.attack.value = .008; compressor.release.value = .18; compressor.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(compressor);
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 256; this.master.connect(this.meter);
    this.duck = ctx.createGain(); this.duck.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.duck);
    this.ambience = ctx.createGain(); this.ambience.connect(this.duck);
    this.effects = ctx.createGain(); this.effects.connect(this.master);
    for (const freq of [41, 61.8, 82.4]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = freq; gain.gain.value = .022;
      osc.connect(gain).connect(this.music); osc.start(); this.loops.push(osc); this.drones.push(osc);
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
    let seed = 7103, brown = 0;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; brown = (brown + ((seed / 4294967296) * 2 - 1) * .02) / 1.02; data[i] = brown * 1.7; }
    // Smooth the loop seam; no downloaded ambient recordings or hidden music.
    const seam = Math.min(512, data.length / 8);
    for (let i = 0; i < seam; i++) { const envelope = i / seam; data[i] *= envelope; data[data.length - 1 - i] *= envelope; }
    this.noiseBuffer = buffer;
    const air = ctx.createBufferSource(); air.buffer = buffer; air.loop = true;
    this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'lowpass'; this.airFilter.frequency.value = 470;
    const airGain = ctx.createGain(); airGain.gain.value = .075; air.connect(this.airFilter).connect(airGain).connect(this.ambience); air.start(); this.loops.push(air);
    this.machine = ctx.createOscillator(); this.machine.type = 'triangle'; this.machine.frequency.value = 110;
    const machineFilter = ctx.createBiquadFilter(); machineFilter.type = 'lowpass'; machineFilter.frequency.value = 200;
    const machineGain = ctx.createGain(); machineGain.gain.value = .009; this.machine.connect(machineFilter).connect(machineGain).connect(this.ambience); this.machine.start(); this.loops.push(this.machine);
  }
  private decodeSamples(): Promise<void> {
    if (this.decoding) return this.decoding;
    const ctx = this.context;
    this.decoding = this.preload().then(async () => {
      if (!ctx || this.context !== ctx || this.disposed) return;
      await Promise.all([...this.raw].map(async ([id, bytes]) => {
        try {
          const buffer = await ctx.decodeAudioData(bytes.slice(0));
          if (this.disposed || this.context !== ctx) return;
          let peak = 0; for (let ch = 0; ch < buffer.numberOfChannels; ch++) for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
          const factor = peak > 0 ? .6 / peak : 1;
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) { const data = buffer.getChannelData(ch); for (let i = 0; i < data.length; i++) data[i] *= factor; }
          this.buffers.set(id, buffer);
        } catch { this.failures.add(AUDIO_FILES[id]); }
      }));
    }); return this.decoding;
  }
  configure(settings: Settings) {
    this.settings = settings;
    if (!settings.heartbeat) this.stopVoices('heartbeat');
    if (settings.reducedScares || settings.reducedMotion) { this.stopVoices('scare'); this.captions = this.captions.filter(c => c.category !== 'scare'); }
    const ctx = this.context; if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.active && !settings.muted ? settings.volume : 0, ctx.currentTime, .04);
    this.music!.gain.setTargetAtTime(settings.music, ctx.currentTime, .06);
    this.ambience!.gain.setTargetAtTime(settings.ambience, ctx.currentTime, .06);
    this.effects!.gain.setTargetAtTime(settings.effects, ctx.currentTime, .04);
  }
  pause() {
    this.active = false; this.stopVoices();
    if (this.context && this.master) { this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.value = 0; if (this.context.state === 'running') void this.context.suspend().catch(() => {}); }
  }
  private stopVoices(group?: string) { for (const v of [...this.voices]) if (!group || v.group === group) v.stop(); }
  private caption(text: string, time: number, priority = 1, duration = 2.5, category: SoundCaption['category'] = 'signal') {
    this.captions = this.captions.filter(c => c.until > time && c.text !== text);
    this.captions.unshift({ text, until: time + duration, priority, category });
    this.captions.sort((a, b) => b.priority - a.priority); this.captions = this.captions.slice(0, 2);
  }
  private output(node: AudioScheduledSourceNode, peak: number, duration: number, options: Options): boolean {
    const ctx = this.context; if (!ctx || !this.effects || !this.active) { node.disconnect(); return false; }
    const group = options.group ?? 'cue', priority = options.priority ?? 1;
    const cap = group.startsWith('hunter') ? 1 : group === 'step' || group === 'heartbeat' ? 2 : 4;
    const sameGroup = [...this.voices].filter(v => v.group === group);
    if (sameGroup.length >= cap) { const victim = sameGroup.find(v => v.priority < priority); if (victim) victim.stop(); else { node.disconnect(); return false; } }
    if (this.voices.size >= 14) { const victim = [...this.voices].find(v => v.priority < priority); if (victim) victim.stop(); else { node.disconnect(); return false; } }
    const start = ctx.currentTime + Math.max(0, options.delay ?? 0), env = ctx.createGain(), nodes: AudioNode[] = [node, env];
    node.connect(env); let last: AudioNode = env;
    if (options.cutoff) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = options.cutoff; last.connect(filter); last = filter; nodes.push(filter); }
    if (options.position) {
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.maxDistance = 32; p.rolloffFactor = 1.3;
      p.positionX.value = options.position.x; p.positionY.value = 1.3; p.positionZ.value = options.position.z;
      last.connect(p); last = p; nodes.push(p);
    }
    last.connect(this.effects);
    env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(Math.min(.25, Math.max(0, peak)), start + .008);
    env.gain.setValueAtTime(Math.min(.25, Math.max(0, peak)), start + Math.max(.009, duration * .35)); env.gain.exponentialRampToValueAtTime(.0001, start + Math.max(.03, duration));
    let cleaned = false;
    const voice: Voice = { group, priority, cleanup: () => { if (cleaned) return; cleaned = true; this.voices.delete(voice); nodes.forEach(n => n.disconnect()); }, stop: () => { try { node.stop(); } catch { /* already ended */ } voice.cleanup(); } };
    node.onended = voice.cleanup; this.voices.add(voice); this.started++; this.peakVoices = Math.max(this.peakVoices, this.voices.size);
    node.start(start); node.stop(start + duration + .04); return true;
  }
  private tone(freq: number, duration: number, gain: number, to = freq, type: OscillatorType = 'sine', options: Options = {}) {
    const ctx = this.context; if (!ctx || !this.active) return;
    const osc = ctx.createOscillator(), start = ctx.currentTime + (options.delay ?? 0); osc.type = type;
    osc.frequency.setValueAtTime(freq, start); osc.frequency.exponentialRampToValueAtTime(Math.max(12, to), start + duration);
    this.output(osc, gain, duration, options);
  }
  private sample(id: Sample, gain: number, options: Options = {}) {
    const ctx = this.context; if (!ctx || !this.active) return;
    const buffer = this.buffers.get(id);
    if (!buffer) { this.fallbackCount++; this.tone(id === 'metal' || id === 'plate' ? 180 : 68, .13, gain * .45, 32, 'triangle', options); return; }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = options.rate ?? 1;
    this.output(source, gain, Math.min(2.8, buffer.duration / source.playbackRate.value), options);
  }
  private hiss(duration: number, gain: number, options: Options = {}) {
    const ctx = this.context; if (!ctx || !this.noiseBuffer || !this.active) return;
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = true; source.playbackRate.value = options.rate ?? 1;
    this.output(source, gain, duration, { cutoff: 1200, ...options });
  }
  event(event: GameEvent, sim?: Simulation) {
    if (sim) this.bind(sim); const s = sim ?? this.bound, time = event.time;
    switch (event.type) {
      case 'mote': this.tone(680, .08, .018, 1040); break;
      case 'overload': this.tone(95, .75, .065, 410, 'triangle', { priority: 3 }); this.caption('OVERLOAD / HUNTERS FLEE', time, 3); this.priorityUntil = time + 1; break;
      case 'radar': this.tone(180, .5, .04, 1000); break;
      case 'relay': this.sample('metal', .12, { priority: 2 }); this.tone(130, .45, .04, 520, 'triangle'); break;
      case 'banish': this.tone(420, .45, .06, 42, 'triangle'); break;
      case 'capture': this.stopVoices(); if (this.context) this.duck?.gain.setTargetAtTime(0, this.context.currentTime, .025); this.tone(this.settings?.reducedScares ? 95 : 155, .6, this.settings?.reducedScares ? .035 : .075, 32, 'triangle', { priority: 4 }); break;
      case 'win': this.stopVoices(); if (this.context) this.duck?.gain.setTargetAtTime(0, this.context.currentTime, .025); this.tone(330, 1.35, .055, 660, 'sine', { priority: 4 }); break;
      case 'step': {
        if (!s) break; const surface = surfaceAt(s); this.lastSurface = surface;
        this.sample(surface === 'metal' ? 'metal' : (['step0', 'step1', 'step2'] as Sample[])[this.stepIndex++ % 3], (event.value ?? .5) * .12, { group: 'step', priority: 0, rate: surface === 'tile' ? 1.12 : .92, cutoff: surface === 'concrete' ? 1400 : 3300 });
        if (surface === 'wet') this.hiss(.12, .065, { group: 'step', priority: 0, cutoff: 950 }); break;
      }
      case 'wave': this.sample('plate', .065, { priority: 3, rate: event.value ? 1.1 : .8 }); this.tone(event.value ? 190 : 110, .4, .025, event.value ? 80 : 180, 'triangle'); this.caption(event.value ? 'CHASE / HUNTERS TRACK YOU' : 'SCATTER / RELIEF WINDOW', time, 3); this.priorityUntil = time + .8; break;
      case 'blackout': this.sample('heavy', .1, { priority: 3, rate: .65 }); this.caption('BLACKOUT / FIND THE EXIT LIFT', time, 4, 4); this.priorityUntil = time + 1.2; break;
      case 'relic': this.sample('bell', .04, { rate: 1.4, priority: 2 }); break;
      case 'extraLife': this.tone(660, .6, .035, 1320); break;
    }
  }
  update(sim: Simulation, scare: ScareEvent | null = null) {
    this.bind(sim); this.captions = this.captions.filter(c => c.until > sim.time);
    if (sim.mode !== 'playing') return;
    if (scare && scare.id !== this.lastScare && !this.settings?.reducedScares) {
      this.lastScare = scare.id; this.stopVoices('scare'); this.caption(`${scare.caption} / ${directionCaption(sim.position, sim.yaw, scare.position)}`, sim.time, 2, scare.duration, 'scare');
      const opts: Options = { group: 'scare', priority: 1, position: scare.position, cutoff: 1800 };
      if (scare.kind === 'lamp' || scare.kind === 'screen') this.sample('metal', .055, opts);
      if (scare.kind === 'steps') { this.sample('step1', .12, opts); this.sample('step2', .08, { ...opts, delay: .43 }); }
      if (scare.kind === 'silhouette') this.hiss(.5, .05, opts);
      if (scare.kind === 'whisper') this.hiss(1.6, .12, { ...opts, cutoff: 2000, rate: 1.4 });
    }
    if (!scare || this.settings?.reducedScares) { this.stopVoices('scare'); this.captions = this.captions.filter(c => c.category !== 'scare'); }
    if (this.wasPowered && sim.overload > 0 && sim.overload < 2.5) { this.caption('POWER FADING / PLAN YOUR ESCAPE', sim.time, 3); this.tone(480, .18, .02, 240); this.wasPowered = false; }
    if (sim.overload > 3) this.wasPowered = true;
    // Silent/unsupported audio still retains the text cue path above.
    const ctx = this.context; if (!ctx || !this.active || !this.settings) return;
    if (sim.time - this.lastSpatial < .1) return; this.lastSpatial = sim.time;
    const listener = ctx.listener;
    listener.positionX.value = sim.position.x; listener.positionY.value = 1.62; listener.positionZ.value = sim.position.z;
    listener.forwardX.value = -Math.sin(sim.yaw); listener.forwardY.value = 0; listener.forwardZ.value = -Math.cos(sim.yaw);
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    const mix = chapterMix(sim.level.id), t = ctx.currentTime;
    this.drones.forEach((osc, i) => osc.frequency.setTargetAtTime(mix.drones[i], t, .5));
    this.airFilter!.frequency.setTargetAtTime(mix.airHz, t, .4); this.machine!.frequency.setTargetAtTime(mix.machineHz + Math.sin(sim.time * .3) * 1.5, t, .3);
    const pressure = threatPressure(sim);
    this.duck!.gain.setTargetAtTime(sim.time < this.priorityUntil ? .55 : 1 - pressure * .25, t, .08);
    if (this.settings.heartbeat && pressure > .05 && sim.time >= this.nextHeartbeat) {
      const gain = (.018 + pressure * .028) * (this.settings.reducedScares ? .65 : 1);
      this.tone(62, .14, gain, 30, 'sine', { group: 'heartbeat', priority: 1 }); this.tone(51, .13, gain * .7, 27, 'sine', { group: 'heartbeat', priority: 1, delay: .16 });
      this.nextHeartbeat = sim.time + 1.15 - pressure * .6;
    }
    for (const e of sim.enemies) {
      const cue = hunterSound(sim, e); if (!cue.audible || sim.time < (this.nextHunter.get(e.id) ?? 0)) continue;
      this.nextHunter.set(e.id, sim.time + cue.interval);
      const opts: Options = { group: `hunter-${e.id}`, position: { ...e.position }, cutoff: cue.cutoff, priority: 2 };
      if (e.kind === 'Stalker') this.sample('heavy', cue.gain, { ...opts, rate: .75 });
      else if (e.kind === 'Mimic') this.sample((['step0', 'step1', 'step2'] as Sample[])[this.stepIndex++ % 3], cue.gain * .9, { ...opts, rate: .95 });
      else if (e.kind === 'Puppet') { this.sample('wood', cue.gain, { ...opts, rate: .8 }); this.tone(610, .28, cue.gain * .07, 240, 'triangle', { ...opts, group: `wire-${e.id}`, priority: 1 }); }
      else { this.tone(180, 1.1, cue.gain * .25, 95, 'triangle', opts); this.hiss(.7, cue.gain * .2, { ...opts, group: `weep-${e.id}`, cutoff: cue.blocked ? 300 : 800, priority: 1 }); }
      if (cue.caption && this.settings.captions) this.caption(`${e.kind.toUpperCase()} / ${HUNTER_CAPTION[e.kind]} / ${directionCaption(sim.position, sim.yaw, e.position)}${cue.blocked ? ' / MUFFLED' : ''}`, sim.time, 1, 1.7, 'hunter');
    }
    if (sim.time >= this.nextDrip) {
      this.nextDrip = sim.time + (sim.level.id === 'drainworks' ? 3.2 : 6.5);
      if (sim.level.id === 'drainworks') this.tone(940, .12, .012, 520, 'sine', { position: { x: sim.position.x + 3, z: sim.position.z - 5 }, priority: 0 });
      else if (sim.level.id === 'core') this.sample('plate', .018, { position: { x: sim.position.x - 6, z: sim.position.z - 4 }, rate: .6, priority: 0 });
    }
  }
  diagnostics() { const data = new Float32Array(256); this.meter?.getFloatTimeDomainData(data); const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length); return { state: this.context?.state ?? 'uncreated', active: this.active, decoded: this.buffers.size, failures: [...this.failures], voices: this.voices.size, peakVoices: this.peakVoices, started: this.started, loops: this.loops.length, fallbackCount: this.fallbackCount, rms,
    gains: { master: this.master?.gain.value ?? 0, music: this.music?.gain.value ?? 0, ambience: this.ambience?.gain.value ?? 0, effects: this.effects?.gain.value ?? 0 }, surface: this.lastSurface, captions: this.captions.map(c => c.text) }; }
  dispose() {
    this.disposed = true; this.active = false; this.abort.abort(); this.stopVoices();
    for (const source of this.loops) { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); }
    this.loops = []; this.raw.clear(); this.buffers.clear(); this.captions = []; void this.context?.close().catch(() => {}); this.context = null;
  }
}
