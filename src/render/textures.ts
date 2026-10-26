import * as THREE from 'three';

function random(seed: number) { let s = seed; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; }
export function surfaceTexture(kind: 'wall' | 'floor' | 'ceiling', levelId: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!, r = random(kind === 'wall' ? 21 : 71);
  c.fillStyle = kind === 'wall' ? (levelId === 'drainworks' ? '#6c7770' : '#8a8a75') : kind === 'floor' ? '#4c544f' : '#424944';
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) { c.fillStyle = r() > .48 ? '#fff1c60a' : '#081b1630'; c.fillRect(r() * 512, r() * 512, r() * 4 + 1, r() * 3 + 1); }
  if (kind === 'wall') {
    c.fillStyle = levelId === 'core' ? '#633c3077' : '#2a514c66'; c.fillRect(0, 294, 512, 218);
    c.fillStyle = '#8e795733'; c.fillRect(0, 285, 512, 10); c.fillStyle = '#182f2777'; c.fillRect(0, 305, 512, 3);
    for (let i = 0; i < 35; i++) {
      const x = r() * 512, w = r() * 40 + 4; const g = c.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#111b204d'); g.addColorStop(.8, '#111b2000'); c.fillStyle = g; c.fillRect(x, 0, w, 512 * r());
    }
    for (const x of [5, 506]) { c.fillStyle = '#1b282b88'; c.fillRect(x, 0, 2, 512); }
    c.fillStyle = '#171d1d'; for (const x of [16, 495]) for (const y of [16, 497]) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#22282055'; c.lineWidth = 1; c.beginPath(); c.moveTo(70, 33); c.lineTo(98, 73); c.lineTo(89, 110); c.lineTo(117, 154); c.stroke();
  } else {
    c.strokeStyle = '#16232099'; c.lineWidth = 3;
    for (const v of [0, 128, 256, 384, 512]) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, 512); c.moveTo(0, v); c.lineTo(512, v); c.stroke(); }
    for (let i = 0; i < 22; i++) { c.fillStyle = '#102c2730'; c.beginPath(); c.ellipse(r() * 512, r() * 512, r() * 45, r() * 20, r() * 3, 0, Math.PI * 2); c.fill(); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}
export function signTexture(title: string, subtitle: string, color = '#e2c88f'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256; const c = canvas.getContext('2d')!;
  c.fillStyle = '#17221f'; c.fillRect(0, 0, 512, 256); c.strokeStyle = color; c.lineWidth = 5; c.strokeRect(12, 12, 488, 232);
  c.fillStyle = color; c.font = 'bold 62px Arial'; c.textAlign = 'center'; c.fillText(title, 256, 112); c.font = '22px monospace'; c.fillText(subtitle, 256, 172);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Original transparent wear, over photographic CC0 surfaces. Seeded stains and
// oxide streaks break repetition without downloaded decal packs or new blockers.
export function grimeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!, r = random(9301);
  for (let i = 0; i < 42; i++) {
    const x = r() * 512, width = 2 + r() * 25, height = 60 + r() * 300;
    const g = c.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#422a1c99'); g.addColorStop(.45, '#30241e44'); g.addColorStop(1, '#1a191700');
    c.fillStyle = g; c.fillRect(x, 0, width, height);
  }
  for (let i = 0; i < 100; i++) {
    c.fillStyle = i % 2 ? '#221d1a18' : '#54312218'; c.beginPath(); c.ellipse(r() * 512, 360 + r() * 152, r() * 65, r() * 25, r() * 3, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = '#29232666'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(280, 160); c.lineTo(297, 204); c.lineTo(289, 230); c.lineTo(309, 278); c.lineTo(302, 301); c.stroke();
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.name = 'original-seeded-grime'; return t;
}
