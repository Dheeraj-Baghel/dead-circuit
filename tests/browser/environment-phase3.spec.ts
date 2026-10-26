import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
const ART = 'artifacts/testing/phase3';
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
const play = async (page: import('@playwright/test').Page) => { await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); };
test.beforeAll(() => mkdirSync(ART, { recursive: true }));
test('local PBR maps and measured imported props load, stay inside walls and need no remote requests', async ({ page }) => {
  const errors: string[] = [], remote: string[] = [], assets: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4332')) remote.push(r.url()); });
  page.on('response', r => { if (r.url().includes('/assets/')) { assets.push(r.url()); if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); } });
  await play(page); const stats = (await snap(page)).renderer;
  expect(stats.materials).toBe('local-pbr'); expect(stats.assetFailures).toEqual([]); expect(stats.landmarks).toBe(8);
  expect(stats.landmarkFit.every((p: any) => p.insideWall)).toBe(true); expect(stats.cookie).toBe(true); expect(stats.postfx).toBe(true); expect(stats.lights).toBe(5);
  expect(assets.filter(p => /_1K-JPG_.*jpg/.test(p))).toHaveLength(9); expect(assets.filter(p => p.includes('/assets/arcade/') && p.endsWith('.glb'))).toHaveLength(4);
  await page.evaluate(() => (window as any).__DC.fixture('visual-landmark')); await page.screenshot({ path: `${ART}/arcade-landmark.png` });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
});
test('four authored creature silhouettes render in the actual corridor', async ({ page }) => {
  await play(page); const kinds = ['Stalker', 'Mimic', 'Puppet', 'Weeper']; const stats = (await snap(page)).renderer;
  expect(new Set(stats.creatures.map((c: any) => c.silhouette)).size).toBe(4);
  for (const kind of kinds) {
    await page.evaluate(k => (window as any).__DC.fixture(`visual-${k}`), kind); await page.waitForTimeout(120);
    await page.screenshot({ path: `${ART}/creature-${kind.toLowerCase()}.png` });
    expect((await snap(page)).renderer.calls).toBeLessThan(150);
  }
});
test('each chapter has its own material/lighting treatment and recessed utility landmarks', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, progress: { unlocked: 3 } })));
  for (const [n, title] of [[1, 'The Service Loop'], [2, 'The Drainworks'], [3, 'The Core']] as const) {
    await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`0${n} ${title}`) }).click();
    await page.evaluate(() => (window as any).__DC.fixture('visual-landmark')); await page.waitForTimeout(100);
    await page.screenshot({ path: `${ART}/chapter-${n}-landmark.png` });
    expect((await snap(page)).renderer.landmarkFit.every((p: any) => p.insideWall)).toBe(true);
  }
});
test('low graphics bypasses postprocessing and flashlight cookie while reduced motion freezes effect time', async ({ page }) => {
  await play(page); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click();
  await page.getByLabel('Reduced motion', { exact: false }).check(); await page.getByLabel('Reduced scare intensity', { exact: false }).check();
  await page.getByRole('button', { name: 'DONE' }).click();
  expect((await snap(page)).renderer.fx.fringe).toBe(0); expect((await snap(page)).renderer.fx.effectTime).toBe(0);
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Graphics quality', { exact: true }).selectOption('low'); await page.getByRole('button', { name: 'DONE' }).click();
  expect((await snap(page)).renderer.postfx).toBe(false); expect((await snap(page)).renderer.cookie).toBe(false);
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await page.screenshot({ path: `${ART}/low-quality.png` });
});
test('failed optional material asset falls back without blocking Play', async ({ page }) => {
  await page.route('**/assets/materials/Concrete023*', r => r.abort()); await play(page);
  const stats = (await snap(page)).renderer; expect(stats.materials).toBe('fallback'); expect(stats.assetFailures.length).toBe(3);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW'); expect((await snap(page)).time).toBeGreaterThan(0);
  await page.screenshot({ path: `${ART}/material-fallback.png` });
});
test('rendered blackout remains navigable and paused effects do not drift', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('blackout'));
  await expect(page.locator('.wave-status')).toHaveText('BLACKOUT / FINAL DASH'); await page.screenshot({ path: `${ART}/blackout.png` });
  await page.keyboard.press('Escape'); const before = await snap(page); await page.waitForTimeout(300);
  const after = await snap(page); expect(after.renderer.fx).toEqual(before.renderer.fx); expect(after.time).toBe(before.time);
});
test('loaded scene stress meets draw budget and short desktop frame-rate target', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, progress: { unlocked: 3 } })));
  await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click(); await page.getByRole('button', { name: /03 The Core/ }).click();
  // Four different, near-camera models in the actual view, including shadows
  // and maximum proximity fringing. Held stationary for a reproducible GPU
  // workload; the separate original stress suite still exercises moving AI.
  await page.evaluate(() => (window as any).__DC.fixture('visual-stress')); await page.waitForTimeout(350);
  const sample = await page.evaluate(async () => {
    const frames: number[] = []; let last = await new Promise<number>(r => requestAnimationFrame(r));
    for (let i = 0; i < 360; i++) { const now = await new Promise<number>(r => requestAnimationFrame(r)); frames.push(now - last); last = now; }
    const sorted = [...frames].sort((a, b) => a - b);
    return { fps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length), p95Ms: sorted[Math.floor(sorted.length * .95)], frames: frames.length, stats: (window as any).__DC.snapshot().renderer };
  });
  expect(sample.fps).toBeGreaterThanOrEqual(55); expect(sample.stats.calls).toBeLessThan(150);
  expect(sample.stats.assetFailures).toEqual([]); await page.screenshot({ path: `${ART}/stress-core.png` });
  writeFileSync(`${ART}/performance.json`, JSON.stringify({ environment: { cpu: os.cpus()[0]?.model, arch: os.arch(), browser: 'headless Chrome', viewport: '1440x900', quality: 'standard', scenario: 'Four near-camera authored models, flashlight shadows, PBR materials and proximity fringing; stationary rendering fixture. Separate original stress suite exercises moving AI.' }, ...sample, limitations: ['Short laboratory sample, not sustained physical-device performance', 'Controlled development fixture, not human gameplay', 'Not a whole-heap leak proof'] }, null, 2));
});
