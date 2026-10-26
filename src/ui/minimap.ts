import { CELL, isWall, key, worldAt } from '../game/levels';
import type { Simulation } from '../game/simulation';
import { DEFAULT_MAP, HUNTER_STYLE, mapMarkers, mapTransform, type MapOptions } from './mapModel';

// One Canvas 2D map, no second WebGL renderer. Full grid and all marker positions
// share one world->map transform. Labels stay upright in heading-up mode.
export function drawMinimap(canvas: HTMLCanvasElement, sim: Simulation, options: MapOptions = DEFAULT_MAP) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const size = Math.max(120, Math.round(canvas.clientWidth || 240)), dpr = Math.min(devicePixelRatio, 2);
  if (canvas.width !== Math.round(size * dpr) || canvas.height !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0c1719'; ctx.fillRect(0, 0, size, size);
  const l = sim.level, transform = mapTransform(sim, size, options.mapOrientation), tile = CELL * transform.scale;
  const project = transform.project;
  const dot = (p: { x: number; z: number }, radius: number, fill: string) => { const xy = project(p); ctx.beginPath(); ctx.arc(xy.x, xy.z, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };

  ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(transform.angle);
  ctx.translate(-transform.center.x * transform.scale, -transform.center.z * transform.scale);
  for (let z = 0; z < l.height; z++) for (let x = 0; x < l.width; x++) {
    if (isWall(l, x, z, 'hunter')) continue;
    const symbol = l.grid[z][x];
    ctx.fillStyle = symbol === 'H' ? '#543b46' : symbol === 'T' ? '#385b63' : options.highContrast ? '#7a9188' : '#3f5655';
    ctx.fillRect(x * tile, z * tile, tile, tile);
    if (symbol === 'H') { ctx.strokeStyle = '#b48790'; ctx.lineWidth = .6; ctx.strokeRect(x * tile + 1, z * tile + 1, tile - 2, tile - 2); }
  }
  if (l.lockup) {
    const d = l.lockup.door;
    ctx.strokeStyle = '#ffb49c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d.x * tile, d.z * tile + 1); ctx.lineTo((d.x + 1) * tile, d.z * tile + 1); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((d.x + i / 4) * tile, d.z * tile); ctx.lineTo((d.x + i / 4) * tile, d.z * tile + 4); ctx.stroke(); }
  }
  ctx.restore();

  for (const p of sim.pickups) if (!p.collected) {
    if (p.kind === 'mote') dot(p.position, size > 300 ? 1.6 : 1.2, '#f5d69a');
    else { const a = project(p.position); ctx.save(); ctx.translate(a.x, a.z); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#a4f0d5'; ctx.fillRect(-2.7, -2.7, 5.4, 5.4); ctx.strokeStyle = '#102625'; ctx.lineWidth = 1; ctx.strokeRect(-2.7, -2.7, 5.4, 5.4); ctx.restore(); }
  }
  if (l.tunnelRow !== undefined) {
    for (const x of [0, l.width - 1]) {
      const p = project(worldAt({ x, z: l.tunnelRow }));
      ctx.save(); ctx.translate(p.x, p.z); ctx.rotate(transform.angle); ctx.strokeStyle = '#b6ecf1'; ctx.lineWidth = 1.5;
      const sign = x === 0 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(-sign * 2, -3); ctx.lineTo(sign * 2, 0); ctx.lineTo(-sign * 2, 3); ctx.stroke(); ctx.restore();
    }
  }
  for (const c of l.relays) {
    const p = project(worldAt(c)); ctx.strokeStyle = sim.relays.has(key(c)) ? '#a8dfbd' : '#edc594'; ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 2, p.z - 2, 4, 4);
  }
  const start = project(worldAt(l.start)); ctx.strokeStyle = '#a8c3ff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(start.x, start.z, 4, 0, Math.PI * 2); ctx.stroke();
  const exit = project(worldAt(l.exit)); ctx.strokeStyle = sim.exitOpen ? '#b3f6cf' : '#edc594'; ctx.lineWidth = 1.5;
  ctx.strokeRect(exit.x - 4, exit.z - 4, 8, 8);
  if (sim.exitOpen) { ctx.beginPath(); ctx.moveTo(exit.x - 2, exit.z); ctx.lineTo(exit.x, exit.z + 2); ctx.lineTo(exit.x + 3, exit.z - 2); ctx.stroke(); }
  if (sim.relic) {
    const p = project(sim.relic.position); ctx.fillStyle = '#fff1af'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('★', p.x, p.z + 4);
  }

  for (const m of mapMarkers(sim, options)) {
    const p = project(m.position), style = HUNTER_STYLE[m.kind], stale = m.source === 'last-seen', heard = m.source === 'heard';
    ctx.save(); ctx.translate(p.x, p.z);
    ctx.globalAlpha = stale ? Math.max(.4, 1 - m.age / 5) : 1;
    ctx.strokeStyle = m.state === 'frightened' ? '#a4f0d5' : options.highContrast ? '#ffffff' : style.color;
    ctx.lineWidth = 1.4; ctx.fillStyle = '#111e23';
    if (heard || stale) {
      ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(0, 0, heard ? Math.max(8, m.uncertainty * transform.scale) : 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    const r = Math.min(6, Math.max(4.5, size / 48));
    ctx.beginPath();
    if (m.state === 'returning') { ctx.arc(0, 0, r, 0, Math.PI * 2); }
    else if (style.shape === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (style.shape === 'square') ctx.rect(-r, -r, r * 2, r * 2);
    else if (style.shape === 'diamond') { ctx.moveTo(0, -r - 1); ctx.lineTo(r + 1, 0); ctx.lineTo(0, r + 1); ctx.lineTo(-r - 1, 0); ctx.closePath(); }
    else { ctx.moveTo(0, -r - 1); ctx.lineTo(r + 1, r); ctx.lineTo(-r - 1, r); ctx.closePath(); }
    ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.min(10, r + 3)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.state === 'returning' ? '~' : heard ? '?' : style.letter, 0, style.shape === 'triangle' ? 1 : 0); ctx.restore();
  }
  const player = project(sim.position);
  if (sim.radar > 0) { ctx.strokeStyle = '#a7e7d955'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(player.x, player.z, (3 - sim.radar) / 3 * CELL * 8 * transform.scale, 0, Math.PI * 2); ctx.stroke(); }
  ctx.save(); ctx.translate(player.x, player.z); ctx.rotate(transform.playerAngle);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 17, -Math.PI / 2 - .45, -Math.PI / 2 + .45); ctx.closePath(); ctx.fillStyle = '#ffe2a326'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fillStyle = '#ffe3a8'; ctx.strokeStyle = '#121b21'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); ctx.restore();
  // Compass remains explicit in either orientation; no fake north-up label.
  ctx.save(); ctx.translate(size - 11, 11); ctx.rotate(transform.angle); ctx.strokeStyle = '#d4e5dc'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.lineTo(-2, -2); ctx.moveTo(0, -5); ctx.lineTo(2, -2); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#d4e5dc'; ctx.textAlign = 'right'; ctx.font = '8px monospace'; ctx.fillText('N', size - 18, 14);
}
