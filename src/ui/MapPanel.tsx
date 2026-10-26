import type { RefObject } from 'react';
import type { Simulation } from '../game/simulation';
import type { Archetype } from '../game/hunters';
import type { Settings } from '../services/storage';
import { HUNTER_STYLE, mapMarkers, markerLabel, waveReadout } from './mapModel';
import { keyLabel } from './SettingsPanel';

export function HunterGlyph({ kind }: { kind: Archetype }) {
  const { shape, letter, color } = HUNTER_STYLE[kind];
  return <svg className="hunter-glyph" viewBox="0 0 28 28" aria-hidden="true" style={{ color }}>
    {shape === 'circle' ? <circle cx="14" cy="14" r="11" /> : shape === 'square' ? <rect x="4" y="4" width="20" height="20" /> : shape === 'diamond' ? <path d="M14 2L26 14L14 26L2 14Z" /> : <path d="M14 2L27 25H1Z" />}
    <text x="14" y={shape === 'triangle' ? 19 : 18}>{letter}</text>
  </svg>;
}
export function MapLegend({ detailed = false }: { detailed?: boolean }) {
  return <div className={`map-legend ${detailed ? 'detailed' : ''}`} aria-label="Map symbol legend">
    <span>• MEMORY</span><span>◇ POWER</span><span>□ LIFT</span><span>○ REFUGE</span><span>▥ LOCKUP</span><span>↔ TUNNEL</span><span>★ RELIC</span>
    {detailed && <><span>~ RETURNING WISP</span><span>DASHED: LAST FIX / ? SOUND ESTIMATE</span></>}
  </div>;
}
export function MapPanel({ sim, settings, canvas, onEnlarge }: { sim: Simulation; settings: Settings; canvas: RefObject<HTMLCanvasElement | null>; onEnlarge: () => void }) {
  const wave = waveReadout(sim), markers = mapMarkers(sim, settings);
  const circumference = 2 * Math.PI * 22;
  return <aside className={`map-panel ${settings.highContrast ? 'map-high-contrast' : ''}`} style={{ '--map-scale': settings.mapScale } as React.CSSProperties} aria-label="Left-side maze minimap">
    <div className="map-heading"><span>SUBLEVEL {sim.level.number}</span><span>{settings.mapOrientation === 'north' ? 'N ↑ / NORTH UP' : '↑ / HEADING UP'}</span></div>
    <div className={`wave-readout wave-${wave.kind}`}>
      <svg className="wave-ring" viewBox="0 0 52 52" role="img" aria-label={`${wave.label}: ${wave.remaining === null ? wave.detail : `${Math.ceil(wave.remaining)} seconds remaining`}`}>
        <circle className="wave-track" cx="26" cy="26" r="22" /><circle className="wave-arc" cx="26" cy="26" r="22" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - wave.ratio)} transform="rotate(-90 26 26)" />
        <text x="26" y="30">{wave.remaining === null ? wave.kind === 'blackout' ? '!' : '∞' : Math.ceil(wave.remaining)}</text>
      </svg>
      <div><strong className="wave-status">{wave.kind === 'blackout' ? 'BLACKOUT / FINAL DASH' : wave.label}</strong><small>{wave.detail}</small></div>
    </div>
    <div className="map-viewport"><canvas ref={canvas} aria-label="Shared maze: memory, power cells, player, Lockup gate, tunnels, refuge, relic and exit lift" /></div>
    <MapLegend />
    <div className="hunter-key" aria-label="Hunter identities and map observations">
      {sim.enemies.map(e => { const marker = markers.find(m => m.id === e.id); return <div key={e.id} className="hunter-observation" data-hunter={e.kind} data-source={marker?.source ?? 'unknown'}>
        <HunterGlyph kind={e.kind} /><div><b>{e.kind}</b><small>{marker ? markerLabel(marker) : 'NO CONFIRMED FIX'}</small></div>
      </div>; })}
    </div>
    <p className="map-knowledge">{settings.mapVisibility === 'arcade' ? 'ARCADE: ALL HUNTERS LIVE' : 'LIVE = VIEW / RADAR · DASHED = LAST FIX / ? SOUND'}</p>
    <div className="map-caption"><span>{sim.level.title.toUpperCase()}</span><button onClick={onEnlarge} aria-label="Enlarge minimap">↗ MAP</button></div>
    <p className="radar-status">{keyLabel(settings.bindings.radar)} / RADAR <span>{sim.radarCooldown > 0 ? `${Math.ceil(sim.radarCooldown)}s` : 'READY'}</span></p>
  </aside>;
}
