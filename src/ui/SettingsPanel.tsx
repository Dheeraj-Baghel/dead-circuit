import { useState } from 'react';
import type { Bindings, Settings } from '../services/storage';
import { isBindableCode } from '../services/controls';
export const keyLabel = (code: string) => code.replace('Key', '').replace('Digit', '').replace('Left', '').replace('Right', ' R').replace('Arrow', '');
export function SettingsPanel({ settings, onChange, onClose, onReset }: { settings: Settings; onChange: (value: Settings) => void; onClose: () => void; onReset: () => void }) {
  const [binding, setBinding] = useState<keyof Bindings | null>(null), [bindingError, setBindingError] = useState('');
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const slider = (label: string, key: 'volume' | 'music' | 'ambience' | 'effects' | 'sensitivity' | 'fov' | 'mapScale', min: number, max: number, step: number, display: string) => <label className="setting range"><span>{label} <output>{display}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]} onChange={e => update(key, Number(e.target.value))} /></label>;
  const toggle = (label: string, key: 'muted' | 'invert' | 'reducedMotion' | 'reducedScares' | 'captions' | 'highContrast' | 'practice' | 'heartbeat', detail?: string) => <label className="setting toggle"><span>{label}{detail && <small>{detail}</small>}</span><input type="checkbox" checked={settings[key]} onChange={e => update(key, e.target.checked)} /></label>;
  return <div className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-heading" onKeyDown={e => {
    if (!binding) return; e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { setBinding(null); return; }
    if (!isBindableCode(e.code)) { setBindingError('Choose a letter, number, Shift, Control, Alt or Space. Arrow keys move, J/L turn, and Escape pauses; those keys are reserved.'); return; }
    if (Object.entries(settings.bindings).some(([k, v]) => k !== binding && v === e.code)) { setBindingError('That key is already assigned. Choose another.'); return; }
    update('bindings', { ...settings.bindings, [binding]: e.code }); setBinding(null); setBindingError('');
  }}>
    <div className="dialog-top"><p className="eyebrow">TUNE YOUR TRANSMISSION</p><button className="icon-button" aria-label="Close settings" onClick={onClose}>×</button></div><h2 id="settings-heading">Control the fear.</h2><p>Changes apply immediately. The maze stays paused.</p>
    <div className="settings-columns"><section><h3>AUDIO / COMFORT</h3>
      {slider('Master volume', 'volume', 0, 1, .05, `${Math.round(settings.volume * 100)}%`)}
      {slider('Music volume', 'music', 0, 1, .05, `${Math.round(settings.music * 100)}%`)}
      {slider('Ambience volume', 'ambience', 0, 1, .05, `${Math.round(settings.ambience * 100)}%`)}
      {slider('Effects volume', 'effects', 0, 1, .05, `${Math.round(settings.effects * 100)}%`)}
      {toggle('Mute all audio', 'muted')}{toggle('Reduced motion', 'reducedMotion', 'Static pickups/lighting, frozen poses and no animated scare events; no camera bob or shake.')}
      {toggle('Reduced scare intensity', 'reducedScares', 'Disables optional scare events immediately; softer capture sound and restrained overlay.')}
      {toggle('Proximity heartbeat', 'heartbeat', 'Optional pulse when an unpowered hunter is close. Disabling it does not change threat captions.')}
      {toggle('Directional threat captions', 'captions')}
      {slider('Horizontal field of view', 'fov', 75, 115, 5, `${settings.fov}°`)}
    </section><section><h3>DISPLAY / CHALLENGE</h3>
      <label className="setting"><span>Camera view<small>Third person shows your animated character; first person retains the original viewpoint.</small></span><select aria-label="Camera view" value={settings.cameraMode} onChange={e => update('cameraMode', e.target.value as Settings['cameraMode'])}><option value="third">Third person / follow</option><option value="first">First person</option></select></label>
      {slider('Minimap scale', 'mapScale', .85, 1.35, .05, `${Math.round(settings.mapScale * 100)}%`)}{toggle('High-contrast minimap', 'highContrast')}
      <label className="setting"><span>Hunter map visibility<small>Confirmed fixes + approximate sounds, or always-live Arcade tracking. No change to hunter AI.</small></span><select aria-label="Hunter map visibility" value={settings.mapVisibility} onChange={e => update('mapVisibility', e.target.value as Settings['mapVisibility'])}><option value="confirmed">Confirmed + heard</option><option value="arcade">Arcade / all hunters live</option></select></label>
      <label className="setting"><span>Minimap orientation<small>The enlarged pause map always stays north-up.</small></span><select aria-label="Minimap orientation" value={settings.mapOrientation} onChange={e => update('mapOrientation', e.target.value as Settings['mapOrientation'])}><option value="north">North up</option><option value="heading">Heading up / rotates with you</option></select></label>
      <label className="setting"><span>Graphics quality</span><select aria-label="Graphics quality" value={settings.quality} onChange={e => update('quality', e.target.value as Settings['quality'])}><option value="standard">Standard</option><option value="low">Low / no shadows</option></select></label>
      <label className="setting"><span>Challenge<small>Applies immediately, including this run.</small></span><select aria-label="Challenge" value={settings.difficulty} onChange={e => update('difficulty', e.target.value as Settings['difficulty'])}><option value="standard">Standard</option><option value="relaxed">Relaxed</option></select></label>
      {toggle('Capture-free practice', 'practice', 'No records or chapter unlocks while practice is enabled.')}
      {slider('Look sensitivity', 'sensitivity', .2, 3, .1, settings.sensitivity.toFixed(1))}{toggle('Invert mouse look', 'invert')}
      <h3>REMAP CONTROLS</h3><div className="binding-grid">{(Object.keys(settings.bindings) as (keyof Bindings)[]).map(key => <button key={key} className={binding === key ? 'binding listening' : 'binding'} onClick={() => { setBinding(key); setBindingError(''); }} aria-label={`Rebind ${key}`}><span>{key}</span><b>{binding === key ? 'PRESS KEY' : keyLabel(settings.bindings[key])}</b></button>)}</div><p className="setting-hint" role="status">{bindingError || (binding ? 'Press a key, or Escape to cancel. Duplicate assignments are blocked.' : 'WASD or arrows move. Mouse or J/L turn. Escape pauses.')}</p>
    </section></div><div className="settings-footer"><button className="text-button" onClick={onReset}>RESET SETTINGS</button><button className="primary" onClick={onClose}>DONE <span>↗</span></button></div>
  </div>;
}
