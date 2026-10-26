import { CELL, LEVELS, key, walkable, worldAt, type Level, type Point } from './levels';
import { contactFraction, direction, moveTravel } from './movement';
import { distance, isDangerous, makeEnemies, reverseHunters, stepEnemy, waveDurations, type Enemy, type Noise, type WaveMode } from './hunters';

export type Mode = 'menu' | 'playing' | 'paused' | 'caught' | 'won' | 'lost';
export type Input = { forward: number; right: number; sprint: boolean; turn: number };
export type Pickup = { id: string; position: Point; kind: 'mote' | 'charge'; collected: boolean };
export type GameEvent = { type: 'mote' | 'overload' | 'banish' | 'capture' | 'win' | 'radar' | 'relay' | 'step' | 'wave' | 'blackout' | 'relic' | 'extraLife'; time: number; value?: number };
export type RunOptions = { nightShift?: boolean; night?: number; score?: number; lives?: number; extraLifeAwarded?: boolean };
export class Simulation {
  level: Level; position: Point; previous: Point;
  yaw = 0; pitch = 0; time = 0; mode: Mode = 'menu'; stamina = 100; exhausted = false;
  pickups: Pickup[] = []; enemies: Enemy[] = []; noises: Noise[] = []; events: GameEvent[] = [];
  lives = 3; score = 0; captures = 0; overload = 0; radar = 0; radarCooldown = 0;
  flashlight = true; sprinting = false; grace = 3; practice = false; relaxed = false; viewFov = 95;
  relays = new Set<string>(); notice = ''; noticeUntil = 0; lastNoise = -10; lastStep = 0;
  wave: WaveMode = 'scatter'; waveIndex = 0; waveRemaining = 9;
  blackout = false; chain = 0; extraLifeAwarded = false; releaseDots = 0; lastMoteAt = 0;
  nightShift = false; night = 1; relic: { position: Point; remaining: number; value: number; title: string } | null = null;
  relicMilestones = new Set<number>();
  constructor(level = LEVELS[0], options: RunOptions = {}) {
    this.level = { ...level, grid: [...level.grid] }; this.position = worldAt(level.start); this.previous = { ...this.position };
    this.practice = !!level.training; this.nightShift = !!options.nightShift; this.night = options.night ?? 1;
    this.score = options.score ?? 0; this.lives = options.lives ?? 3; this.extraLifeAwarded = !!options.extraLifeAwarded;
    this.waveRemaining = waveDurations(level.chapter, this.night)[0];
    this.message(level.description, 8);
    // Pickups are explicit symbols, not every walkable cell. Houses, tunnels,
    // start/exit and new relay shortcuts cannot acquire accidental objectives.
    this.pickups = walkable(level).filter(c => ['.', 'o'].includes(level.grid[c.z][c.x]))
      .map(c => ({ id: key(c), position: worldAt(c), kind: level.grid[c.z][c.x] === 'o' ? 'charge' : 'mote', collected: false }));
    this.enemies = makeEnemies(level);
  }
  get total() { return this.pickups.filter(p => p.kind === 'mote').length; }
  get remaining() { return this.pickups.filter(p => !p.collected && p.kind === 'mote').length; }
  get dotsEaten() { return this.total - this.remaining; }
  get exitOpen() { return this.remaining === 0; }
  get safe() { return distance(this.position, worldAt(this.level.start)) < CELL * 1.15; }
  get nearbyRelay() { return this.level.relays.find(c => !this.relays.has(key(c)) && distance(worldAt(c), this.position) < 1.7); }
  get powerDuration() { return Math.max(4, 10 - (this.level.chapter ?? 1) * 2 - Math.floor((this.night - 1) / 2)) * (this.relaxed ? 1.5 : 1); }
  message(text: string, seconds = 4) { this.notice = text; this.noticeUntil = this.time + seconds; }
  emit(type: GameEvent['type'], value?: number) { this.events.push({ type, time: this.time, value }); }
  award(points: number) {
    this.score += points;
    if (!this.extraLifeAwarded && this.score >= 10000 && !this.level.training) { this.extraLifeAwarded = true; this.lives++; this.emit('extraLife'); this.message('10,000 SIGNAL. An extra chance.'); }
  }
  start() { if (this.mode === 'menu' || this.mode === 'paused') this.mode = 'playing'; }
  pause() { if (this.mode === 'playing') this.mode = 'paused'; this.sprinting = false; }
  nextNight(): Simulation {
    if (!this.nightShift || this.mode !== 'won') throw new Error('Finish the current Night Shift first');
    const next = new Simulation(LEVELS[this.night % LEVELS.length], { nightShift: true, night: this.night + 1, score: this.score, lives: this.lives, extraLifeAwarded: this.extraLifeAwarded });
    next.relaxed = this.relaxed; next.practice = this.practice; next.viewFov = this.viewFov; return next;
  }
  resumeAfterCapture() {
    if (this.mode !== 'caught') return;
    this.position = worldAt(this.level.start); this.previous = { ...this.position }; this.yaw = 0; this.pitch = 0;
    this.stamina = 100; this.overload = 0; this.chain = 0; this.radar = 0; this.noises = []; this.relic = null;
    this.releaseDots = 0; this.enemies = makeEnemies(this.level, this.enemies.map(e => e.kind), this.time, true);
    this.grace = this.time + 3; this.mode = 'paused';
    this.waveIndex = 0; this.wave = this.blackout ? 'chase' : 'scatter'; this.waveRemaining = waveDurations(this.level.chapter, this.night)[0];
    this.message('Signal recovered. Three seconds of protection. Collected memory stays collected.');
  }
  pulse() {
    if (this.mode !== 'playing' || this.radarCooldown > 0) return;
    this.radar = 3; this.radarCooldown = 16; this.noises.push({ position: { ...this.position }, expires: this.time + 4 }); this.emit('radar');
    for (const e of this.enemies) if (distance(e.position, this.position) < CELL * 8 && isDangerous(e)) { e.lastSeen = { ...e.position }; e.seenAt = this.time; }
    this.message('Radar sent. The Weeper can hear it.');
  }
  interact() {
    if (this.mode !== 'playing') return;
    const relay = this.nearbyRelay;
    if (!relay) return;
    this.relays.add(key(relay)); this.award(150); this.noises.push({ position: worldAt(relay), expires: this.time + 4 }); this.emit('relay');
    const shortcut = this.level.shortcuts?.find(s => key(s.relay) === key(relay));
    if (shortcut) {
      const grid = this.level.grid.map(row => row.split('')); for (const c of shortcut.cells) grid[c.z][c.x] = ' ';
      this.level.grid = grid.map(row => row.join(''));
    }
    this.message(shortcut ? 'Relay restored. A maintenance shortcut is open on your map.' : 'Relay restored. The corridor lights are back.');
  }
  capture() {
    if (this.mode !== 'playing' || this.practice || this.safe || this.time < this.grace || this.overload > 0) return;
    this.lives--; this.captures++; this.sprinting = false;
    this.mode = this.lives > 0 ? 'caught' : 'lost'; this.emit('capture');
  }
  private beginBlackout() {
    if (this.blackout || this.level.training) return;
    this.blackout = true; this.overload = 0; this.chain = 0; this.relic = null; this.wave = 'chase'; this.waveRemaining = Infinity;
    reverseHunters(this.enemies); for (const e of this.enemies) if (isDangerous(e)) e.state = 'chase';
    this.emit('blackout'); this.message('BLACKOUT. The lift is open. Every hunter is chasing. Get out.', 12);
  }
  private maybeRelic() {
    if (!this.level.relic || this.blackout) return;
    for (const milestone of [30, 70]) if (this.dotsEaten >= Math.ceil(this.total * milestone / 100) && !this.relicMilestones.has(milestone)) {
      this.relicMilestones.add(milestone);
      this.relic = { position: worldAt(this.level.relic), remaining: 10, value: (this.level.chapter ?? 1) * 300,
        title: ['Arcade token', 'Drain seal', 'Core fuse'][(this.level.chapter ?? 1) - 1] };
      this.message(`${this.relic.title} appeared near entry. Ten seconds.`);
    }
  }
  private clock(dt: number) {
    const wasPowered = this.overload > 0;
    this.overload = Math.max(0, this.overload - dt); if (wasPowered && this.overload === 0) this.chain = 0;
    if (!wasPowered && !this.blackout) {
      this.waveRemaining -= dt;
      if (this.waveRemaining <= 1e-8) {
        this.waveIndex++;
        this.waveRemaining = waveDurations(this.level.chapter, this.night)[this.waveIndex] ?? Infinity;
        this.wave = !Number.isFinite(this.waveRemaining) || this.waveIndex % 2 ? 'chase' : 'scatter';
        reverseHunters(this.enemies); this.emit('wave', this.wave === 'chase' ? 1 : 0);
      }
    }
    if (this.relic) { this.relic.remaining -= dt; if (this.relic.remaining <= 0) this.relic = null; }
    this.radar = Math.max(0, this.radar - dt); this.radarCooldown = Math.max(0, this.radarCooldown - dt);
    this.noises = this.noises.filter(n => n.expires > this.time);
  }
  step(dt: number, input: Input) {
    if (this.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0 || dt > .1) return;
    this.previous = { ...this.position }; this.time += dt; this.yaw += input.turn * dt * 1.8; this.clock(dt);
    const moving = Math.hypot(input.forward, input.right) > .01;
    if (this.stamina < 2) this.exhausted = true;
    if (!input.sprint || this.stamina > 30) this.exhausted = false;
    this.sprinting = input.sprint && moving && !this.exhausted && this.stamina > 0;
    this.stamina = Math.max(0, Math.min(100, this.stamina + dt * (this.sprinting ? -26 : 18)));
    const d = direction(this.yaw, input.forward, input.right), speed = this.sprinting ? 5.8 : 3.2;
    const travel = moveTravel(this.level, this.position, d.x * speed * dt, d.z * speed * dt);
    this.position = travel.position; this.previous.x += travel.wrapX;
    if (this.sprinting && this.time - this.lastNoise > .8) { this.noises.push({ position: { ...this.position }, expires: this.time + 2.5 }); this.lastNoise = this.time; }
    if (moving && this.time - this.lastStep > (this.sprinting ? .28 : .46)) { this.lastStep = this.time; this.emit('step', this.sprinting ? 1 : .5); }
    const contacts: { t: number; pickup?: Pickup; enemy?: Enemy; exit?: boolean; relic?: boolean }[] = [];
    const first = (p: Point, radius: number) => {
      for (const segment of travel.segments) { const f = contactFraction(segment.from, segment.to, p, radius); if (f !== null) return segment.start + f * (segment.end - segment.start); }
      return null;
    };
    for (const p of this.pickups) if (!p.collected) { const t = first(p.position, .75); if (t !== null) contacts.push({ t, pickup: p }); }
    if (this.relic) { const t = first(this.relic.position, .75); if (t !== null) contacts.push({ t, relic: true }); }
    for (const e of this.enemies) {
      const fromEnemy = { ...e.position }, active = isDangerous(e); stepEnemy(e, this, dt);
      if (!active || !isDangerous(e)) continue;
      // Unwrap hunter travel, then test nearby periodic images in tunnel segments.
      const span = this.level.width * CELL, delta = { x: e.position.x - fromEnemy.x, z: e.position.z - fromEnemy.z };
      if (Math.abs(delta.x) > span / 2) delta.x += delta.x > 0 ? -span : span;
      let earliest: number | null = null;
      for (const segment of travel.segments) {
        const tunnel = Math.floor(segment.from.z / CELL) === this.level.tunnelRow && Math.floor(fromEnemy.z / CELL) === this.level.tunnelRow;
        for (const offset of tunnel ? [-span, 0, span] : [0]) {
          const a = { x: segment.from.x - fromEnemy.x - delta.x * segment.start - offset, z: segment.from.z - fromEnemy.z - delta.z * segment.start };
          const b = { x: segment.to.x - fromEnemy.x - delta.x * segment.end - offset, z: segment.to.z - fromEnemy.z - delta.z * segment.end };
          const fraction = contactFraction(a, b, { x: 0, z: 0 }, .78);
          if (fraction !== null) { const t = segment.start + fraction * (segment.end - segment.start); earliest = Math.min(earliest ?? 1, t); }
        }
      }
      if (earliest !== null) contacts.push({ t: earliest, enemy: e });
    }
    const exitTime = first(worldAt(this.level.exit), .9); if (exitTime !== null) contacts.push({ t: exitTime, exit: true });
    // Exact ties preserve v1's conservative policy: capture before charge or exit.
    contacts.sort((a, b) => a.t - b.t || Number(!!b.enemy) - Number(!!a.enemy));
    for (const c of contacts) {
      if (this.mode !== 'playing') break;
      if (c.pickup && !c.pickup.collected) {
        const p = c.pickup; p.collected = true;
        if (p.kind === 'charge') {
          this.award(50);
          if (!this.blackout) {
            this.overload = this.powerDuration; this.chain = 0; reverseHunters(this.enemies);
            for (const e of this.enemies) if (isDangerous(e)) e.state = 'frightened';
            this.emit('overload'); this.message('OVERLOAD. Turn the hunt around.', 3);
          }
        } else {
          this.releaseDots++; this.lastMoteAt = this.time; this.award(10); this.emit('mote'); this.maybeRelic();
          if (this.exitOpen) { this.beginBlackout(); if (this.level.training) this.message('Every memory recovered. Get to the exit.', 8); }
        }
      }
      if (c.relic && this.relic) { this.award(this.relic.value); this.emit('relic', this.relic.value); this.relic = null; }
      if (c.enemy) {
        const e = c.enemy;
        if (this.overload > 0 && !this.blackout) {
          e.state = 'returning'; e.route = []; e.reversePending = false; this.chain++;
          const value = 200 * 2 ** Math.min(3, this.chain - 1); this.award(value); this.emit('banish', value); this.message(`${e.kind} banished. +${value}`);
        } else this.capture();
      }
      if (c.exit && this.exitOpen) {
        this.award(1000 + Math.max(0, 1200 - Math.floor(this.time * 2)) + this.lives * 100);
        this.mode = 'won'; this.sprinting = false; this.emit('win');
      }
    }
  }
}
