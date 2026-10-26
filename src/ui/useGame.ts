import { useEffect, useRef, useState } from 'react';
import { Simulation } from '../game/simulation';
import { LEVELS, TRAINING, worldAt } from '../game/levels';
import { World } from '../render/world';
import { drawMinimap } from './minimap';
import { mapMarkers } from './mapModel';
import { AudioEngine } from '../services/audio';
import { Atmosphere, SCARE_KINDS } from '../game/atmosphere';
import { defaults, loadSave, save, type Settings } from '../services/storage';
import { gameplayCode, isEditableTarget, movementInput } from '../services/controls';

export function useGame() {
  const [loaded] = useState(() => loadSave(matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [settings, setSettings] = useState(loaded.settings), [progress, setProgress] = useState(loaded.progress), [warning, setWarning] = useState(loaded.warning);
  const [initialSimulation] = useState(() => new Simulation());
  const [audioEngine] = useState(() => new AudioEngine());
  const sim = useRef(initialSimulation), world = useRef<World | null>(null), audio = useRef(audioEngine);
  const atmosphere = useRef(new Atmosphere());
  const canvas = useRef<HTMLCanvasElement>(null), map = useRef<HTMLCanvasElement>(null), keys = useRef(new Set<string>());
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [mode, setMode] = useState(sim.current.mode), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [, refresh] = useState(0), [inputHint, setInputHint] = useState('');
  const firstSave = useRef(true), recordEligible = useRef(true);
  const captureReadyAt = useRef(0);
  useEffect(() => {
    sim.current.relaxed = settings.difficulty === 'relaxed'; sim.current.practice = settings.practice || !!sim.current.level.training;
    sim.current.viewFov = settings.fov;
    if (settings.practice) recordEligible.current = false;
    world.current?.configure(settings); audio.current.configure(settings);
    atmosphere.current.update(sim.current, settings.reducedScares, settings.reducedMotion);
    if (firstSave.current) firstSave.current = false;
    else if (!save(settings, progress)) setWarning('Changes could not be saved. Stored data remains protected; changes are session-only.'); else setWarning('');
  }, [settings, progress]);
  const pause = () => { sim.current.pause(); keys.current.clear(); audio.current.pause(); setMode(sim.current.mode); if (document.pointerLockElement) { captureReadyAt.current = performance.now() + 1100; document.exitPointerLock(); } };
  const captureMouse = () => {
    if (performance.now() < captureReadyAt.current) { setInputHint('Mouse capture is resetting. Arrows + J/L work now; click the scene shortly to capture again.'); return; }
    try { const result = canvas.current?.requestPointerLock(); result?.catch(() => setInputHint('Mouse capture unavailable. Drag the scene to look, or use J / L to turn. Arrow keys move.')); }
    catch { setInputHint('Mouse capture unavailable. Drag the scene to look, or use J / L to turn. Arrow keys move.'); }
  };
  const play = () => {
    sim.current.start(); keys.current.clear(); setMode(sim.current.mode);
    void audio.current.activate(settingsRef.current, sim.current).catch(() => setWarning('Audio could not start. The game remains playable with visual threat cues.'));
    captureMouse();
  };
  const begin = (levelIndex = 0, nightShift = false) => {
    sim.current = new Simulation(levelIndex < 0 ? TRAINING : LEVELS[levelIndex], { nightShift }); sim.current.practice = settingsRef.current.practice || !!sim.current.level.training; sim.current.relaxed = settingsRef.current.difficulty === 'relaxed';
    sim.current.viewFov = settingsRef.current.fov;
    recordEligible.current = !sim.current.practice; atmosphere.current.update(sim.current, settingsRef.current.reducedScares, settingsRef.current.reducedMotion); play();
  };
  const nextNight = () => { sim.current = sim.current.nextNight(); play(); };
  const menu = () => { pause(); sim.current = new Simulation(); sim.current.mode = 'menu'; setMode('menu'); };
  useEffect(() => {
    void audio.current.preload(); // Downloads bytes only; no audio context before Play.
    let frame = 0, last = 0, accumulator = 0, hud = 0, previousMode = sim.current.mode, observedSimulation = sim.current, heldLock = false, dragging = false, previousX = 0, previousY = 0, suspendedGraphics = false, terminalCueUntil = 0;
    try {
      const currentWorld = new World(canvas.current!, sim.current.level); world.current = currentWorld; currentWorld.configure(settingsRef.current);
      void currentWorld.ready.then(() => { if (world.current === currentWorld) setLoading(false); }).catch(() => { if (world.current === currentWorld) { setLoading(false); setError('The animated player model could not load or has no usable Eating clip. Reconnect to retry the supplied GLB; no static replacement has been substituted.'); } });
    }
    catch { setLoading(false); setError('This game needs WebGL 2. Use a current desktop browser with hardware acceleration enabled. No data or permission is needed.'); return; }
    const keydown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { if (sim.current.mode === 'playing') pause(); return; }
      if (sim.current.mode !== 'playing' || isEditableTarget(e.target)) return;
      const b = settingsRef.current.bindings; if (gameplayCode(e.code, b)) e.preventDefault();
      keys.current.add(e.code);
      if (!e.repeat) { if (e.code === b.radar) sim.current.pulse(); if (e.code === b.interact) sim.current.interact(); if (e.code === b.flashlight) sim.current.flashlight = !sim.current.flashlight; }
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const look = (dx: number, dy: number) => { const s = settingsRef.current; sim.current.yaw -= dx * .002 * s.sensitivity; sim.current.pitch = Math.max(-1.2, Math.min(1.2, sim.current.pitch - dy * .002 * s.sensitivity * (s.invert ? -1 : 1))); };
    const mouse = (e: MouseEvent) => { if (sim.current.mode !== 'playing') return; if (document.pointerLockElement === canvas.current) look(e.movementX, e.movementY); else if (dragging) { look(e.clientX - previousX, e.clientY - previousY); previousX = e.clientX; previousY = e.clientY; } };
    const down = (e: MouseEvent) => { if (e.target === canvas.current && sim.current.mode === 'playing') { dragging = true; previousX = e.clientX; previousY = e.clientY; if (!document.pointerLockElement) captureMouse(); } };
    const up = () => { dragging = false; };
    const lock = () => { const has = document.pointerLockElement === canvas.current; if (heldLock && !has) { captureReadyAt.current = performance.now() + 1100; if (sim.current.mode === 'playing') pause(); } heldLock = has; if (has) setInputHint(''); };
    const lockError = () => setInputHint('Mouse capture unavailable. Drag the scene to look, or use J / L to turn. Arrow keys move.');
    const visibility = () => { if (document.hidden) pause(); last = 0; accumulator = 0; };
    const lostContext = (e: Event) => { e.preventDefault(); suspendedGraphics = true; pause(); setError('The graphics connection was interrupted. Reload to reconnect; chapter unlocks and preferences remain saved.'); };
    const restoredContext = () => { suspendedGraphics = false; setError(''); sim.current.message('Graphics restored. Resume when ready.'); };
    const c = canvas.current!;
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('mousemove', mouse); window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('blur', pause);
    document.addEventListener('pointerlockchange', lock); document.addEventListener('pointerlockerror', lockError); document.addEventListener('visibilitychange', visibility);
    c.addEventListener('webglcontextlost', lostContext); c.addEventListener('webglcontextrestored', restoredContext);
    const animate = (now: number) => {
      // A new run can finish before this frame (rapid completion fixtures or
      // restored transitions). Observe run identity as well as mode, so its
      // result/UI/save cannot be mistaken for the preceding run's terminal mode.
      if (observedSimulation !== sim.current) { observedSimulation = sim.current; previousMode = 'menu'; accumulator = 0; }
      const dt = last ? Math.min((now - last) / 1000, .08) : 0; last = now;
      if (sim.current.mode === 'playing' && !document.hidden && !suspendedGraphics) {
        accumulator += dt; let steps = 0;
        while (accumulator >= 1 / 60 && steps++ < 5) {
          sim.current.step(1 / 60, movementInput(keys.current, settingsRef.current.bindings)); accumulator -= 1 / 60;
        }
        accumulator = Math.min(accumulator, 1 / 60);
      } else { accumulator = 0; dragging = false; }
      atmosphere.current.update(sim.current, settingsRef.current.reducedScares, settingsRef.current.reducedMotion);
      for (const event of sim.current.events.splice(0)) { audio.current.event(event, sim.current); if (event.type === 'capture' || event.type === 'win') terminalCueUntil = now + (event.type === 'win' ? 1450 : 700); }
      if (previousMode !== sim.current.mode) {
        previousMode = sim.current.mode; setMode(previousMode);
        if (previousMode !== 'playing') { keys.current.clear(); if (!['caught', 'lost', 'won'].includes(previousMode)) audio.current.pause(); if (document.pointerLockElement) document.exitPointerLock(); }
        if (previousMode === 'won' && !sim.current.level.training && !sim.current.nightShift && recordEligible.current) {
          const completed = sim.current;
          setProgress(p => { const previous = p.best[completed.level.id]; return { ...p, campaignComplete: p.campaignComplete || completed.level.id === LEVELS.at(-1)!.id, unlocked: Math.min(3, Math.max(p.unlocked, LEVELS.findIndex(l => l.id === completed.level.id) + 2)),
            best: { ...p.best, [completed.level.id]: previous && previous.score >= completed.score ? previous : { score: completed.score, time: completed.time, captures: completed.captures } } }; });
        }
        if (['won', 'lost'].includes(previousMode) && sim.current.nightShift && recordEligible.current) {
          const completed = sim.current;
          setProgress(p => ({ ...p, nightBest: { score: Math.max(p.nightBest?.score ?? 0, completed.score), night: Math.max(p.nightBest?.night ?? 1, completed.night) } }));
        }
      }
      if (!document.hidden && !suspendedGraphics) { world.current?.render(sim.current, accumulator / (1 / 60), atmosphere.current.active); if (map.current) drawMinimap(map.current, sim.current, settingsRef.current); }
      if (sim.current.mode === 'playing') audio.current.update(sim.current, atmosphere.current.active);
      else if (now >= terminalCueUntil) audio.current.pause();
      if (now - hud > 100) { refresh(v => v + 1); hud = now; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    // Development-only deterministic fixtures; never included as a usable production interface.
    if (import.meta.env.DEV) {
      (window as unknown as { __DC?: unknown }).__DC = { snapshot: () => ({ mode: sim.current.mode, position: { ...sim.current.position }, yaw: sim.current.yaw, time: sim.current.time, remaining: sim.current.remaining, total: sim.current.total, score: sim.current.score, lives: sim.current.lives, radar: sim.current.radar, overload: sim.current.overload, wave: sim.current.wave, blackout: sim.current.blackout, night: sim.current.night, nightShift: sim.current.nightShift, enemies: sim.current.enemies.map(e => ({ kind: e.kind, state: e.state, position: e.position })), markers: mapMarkers(sim.current, settingsRef.current), renderer: world.current?.diagnostics(), audio: audio.current.context?.state, sound: audio.current.diagnostics(), scare: atmosphere.current.active, nextScare: atmosphere.current.nextAt }),
        fixture: (name: string) => { const s = sim.current; if (name === 'exit') { s.pickups.forEach(p => p.collected = true); s.enemies = s.enemies.map(e => ({ ...e, recoverUntil: s.time + 100 })); s.position = worldAt(s.level.exit); }
          if (name === 'capture') { s.time = Math.max(s.time, 10); s.grace = 0; s.position = worldAt(s.level.spots.contact); s.enemies[0].position = { ...s.position }; s.enemies[0].state = 'chase'; s.enemies[0].route = []; s.overload = 0; }
          if (name === 'power') { const p = s.pickups.find(p => p.kind === 'charge' && !p.collected); if (p) s.position = { ...p.position }; }
          if (name === 'encounter') { s.time = 10; s.grace = 0; s.position = worldAt(s.level.spots.encounter); s.previous = { ...s.position }; s.yaw = 0; s.enemies[0].position = worldAt(s.level.spots.encounterHunter); s.enemies[0].route = []; s.enemies[0].state = 'chase'; }
          if (name === 'relay') s.position = worldAt(s.level.relays[0]);
          if (name === 'stress') { s.time = 10; s.grace = 0; s.practice = true; recordEligible.current = false; s.position = worldAt(s.level.relays[0]); s.interact(); s.position = worldAt(s.level.spots.contact); s.previous = { ...s.position }; s.overload = 8; s.pulse(); s.enemies.forEach((e, i) => { e.position = worldAt({ x: 5 + i, z: 15 }); e.route = []; e.state = 'frightened'; }); }
          if (name === 'tunnel') { s.position = { x: .2, z: (s.level.tunnelRow! + .5) * 2.8 }; s.previous = { ...s.position }; s.yaw = 0; s.grace = s.time + 30; }
          if (name === 'lockup') { s.position = worldAt(s.level.lockup!.outside); s.previous = { ...s.position }; s.yaw = Math.PI; s.grace = s.time + 30; }
          if (name === 'blackout') {
            const last = s.pickups.find(p => p.id === `${s.level.spots.contact.x},${s.level.spots.contact.z}`)!;
            s.pickups.forEach(p => { if (p.kind === 'mote') p.collected = p !== last; });
            s.position = { ...last.position }; s.previous = { ...s.position }; s.yaw = Math.PI; s.grace = s.time + 30;
          }
          if (name === 'relic-life') {
            recordEligible.current = false; s.score = 9990; s.grace = s.time + 30;
            const motes = s.pickups.filter(p => p.kind === 'mote'), count = Math.ceil(s.total * .3);
            motes.slice(0, count - 1).forEach(p => p.collected = true); s.position = { ...motes[count - 1].position };
          }
          if (name === 'map-knowledge') {
            s.time = 10; s.grace = 100; s.position = worldAt({ x: 1, z: 19 }); s.previous = { ...s.position }; s.yaw = 0;
            const cells = [{ x: 1, z: 15 }, { x: 5, z: 15 }, { x: 19, z: 1 }, { x: 1, z: 17 }];
            s.enemies.forEach((e, i) => { e.position = worldAt(cells[i]); e.route = []; e.state = i === 3 ? 'returning' : 'chase'; e.seenAt = -100; e.lastSeen = null; });
            s.enemies[2].lastSeen = worldAt({ x: 1, z: 16 }); s.enemies[2].seenAt = 9;
            s.pause();
          }
          if (name.startsWith('visual-')) {
            recordEligible.current = false; s.practice = true; s.grace = s.time + 100;
            s.enemies.forEach(e => { e.state = 'locked'; e.recoverUntil = s.time + 100; });
            if (name === 'visual-landmark') { s.position = worldAt({ x: 9, z: 19 }); s.yaw = 0; }
            else {
              s.position = worldAt({ x: 1, z: 19 }); s.yaw = 0;
              if (name === 'visual-stress') s.enemies.forEach((e, i) => { e.position = { x: s.position.x, z: s.position.z - 3 - i * 2.8 }; e.route = []; e.state = 'chase'; e.heading = 0; });
              const e = s.enemies.find(e => e.kind === name.slice(7));
              if (e) { e.position = { x: s.position.x, z: s.position.z - 4.8 }; e.route = []; e.state = 'chase'; e.heading = 0; }
            }
            s.previous = { ...s.position };
          }
          if (name.startsWith('scare-')) {
            atmosphere.current.update(s, false); recordEligible.current = false; s.practice = true;
            s.time = 60; s.grace = 0; s.wave = 'scatter'; s.waveRemaining = 20; s.overload = 0;
            s.position = worldAt({ x: 1, z: 19 }); s.yaw = 0;
            if (name === 'scare-screen') { s.position = worldAt({ x: 7, z: 19 }); s.yaw = -Math.PI / 4; }
            if (name === 'scare-steps') s.yaw = Math.PI;
            if (name === 'scare-whisper') s.position = worldAt({ x: 1, z: s.level.tunnelRow! });
            s.previous = { ...s.position }; s.enemies.forEach(e => { e.state = 'locked'; e.recoverUntil = 200; });
            atmosphere.current.active = null; atmosphere.current.nextAt = 60; atmosphere.current.count = Math.max(0, SCARE_KINDS.indexOf(name.slice(6) as typeof SCARE_KINDS[number]));
            if (name === 'scare-danger') { s.wave = 'chase'; s.enemies[0].state = 'chase'; s.enemies[0].position = { x: s.position.x, z: s.position.z - 6 }; }
          }
          if (name === 'audio-storm') { for (let i = 0; i < 100; i++) { s.emit('mote'); s.emit('radar'); } }
          if (name === 'controls') {
            recordEligible.current = false; s.practice = true; s.grace = s.time + 30;
            s.position = worldAt({ x: 10, z: 8 }); s.previous = { ...s.position }; s.yaw = 0;
            s.enemies.forEach(e => { e.state = 'locked'; e.recoverUntil = s.time + 30; });
          }
        } };
    }
    return () => { cancelAnimationFrame(frame); audio.current.dispose(); world.current?.dispose();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('mousemove', mouse); window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('blur', pause);
      document.removeEventListener('pointerlockchange', lock); document.removeEventListener('pointerlockerror', lockError); document.removeEventListener('visibilitychange', visibility); c.removeEventListener('webglcontextlost', lostContext); c.removeEventListener('webglcontextrestored', restoredContext);
      if (import.meta.env.DEV) delete (window as unknown as { __DC?: unknown }).__DC; };
  }, []);
  return { canvas, map, sim, settings, setSettings, progress, setProgress, warning, mode, error, loading, inputHint, pause, play, begin, nextNight, menu, scare: atmosphere.current.active, soundCaptions: audio.current.captions, resumeReady: performance.now() >= captureReadyAt.current,
    resetSettings: () => setSettings(defaults(matchMedia('(prefers-reduced-motion: reduce)').matches)),
    eligible: recordEligible.current, retry: () => begin(sim.current.level.training ? -1 : sim.current.nightShift ? 0 : Math.max(0, LEVELS.findIndex(l => l.id === sim.current.level.id)), sim.current.nightShift) };
}
