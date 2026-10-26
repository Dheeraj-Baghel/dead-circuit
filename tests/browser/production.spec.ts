import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const productionURL = process.env.DC_DEPLOYMENT_URL || 'http://127.0.0.1:4333';
const productionOrigin = new URL(productionURL).origin;
const outputDir = process.env.DC_DEPLOYMENT_URL ? 'artifacts/testing/live' : 'artifacts/testing';
test.use({ baseURL: productionURL });
test('production starts a visible third-person run with the supplied animated model and no fixture API or remote assets', async ({ page }) => {
  const errors: string[] = [], remote: string[] = [], assets: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', req => { if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== productionOrigin) remote.push(req.url()); });
  page.on('response', r => { if (r.url().includes('/assets/materials/') || r.url().includes('/assets/arcade/') || r.url().includes('/assets/player/')) { assets.push(r.url()); if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); } });
  await page.goto('/'); expect(await page.evaluate(() => typeof (window as any).__DC)).toBe('undefined');
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  expect(assets.filter(p => p.endsWith('.glb'))).toHaveLength(5); expect(assets.filter(p => /_1K-JPG_.*jpg/.test(p))).toHaveLength(9);
  expect(assets.some(p => p.endsWith('/player/pacman_animated.glb'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === document.querySelector('.world'))).toBe(true);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2400); await page.keyboard.up('KeyW');
  await expect(page.locator('.memory-count')).not.toHaveText('0');
  await page.screenshot({ path: `${outputDir}/production-gameplay.png` });
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  await page.getByRole('button', { name: 'RETURN TO MENU' }).click();
  await page.screenshot({ path: `${outputDir}/production-menu.png` });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
  const notices = await page.request.get('/licenses.txt'); expect(await notices.text()).toContain('KENNEY MINI ARCADE'); expect(await notices.text()).toContain('AMBIENTCG');
});
test('production menus honor reduced motion, retain preferences, and trap keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.getByRole('button', { name: 'Open settings' }).click(); await expect(page.getByLabel('Reduced motion', { exact: false })).toBeChecked();
  await page.getByLabel('Mute all audio', { exact: true }).check();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'DONE' }).focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();
  await page.getByRole('button', { name: 'DONE' }).click(); await page.reload(); await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByLabel('Mute all audio', { exact: true })).toBeChecked();
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); expect(a11y.violations).toEqual([]);
});
test('production unsupported-WebGL screen is explicit and operable', async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: unknown[]) { return type === 'webgl2' || type === 'webgl' ? null : (original as any).call(this, type, ...args); }; });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Signal unavailable.' })).toBeVisible();
  await expect(page.getByText('This game needs WebGL 2.', { exact: false })).toBeVisible(); await expect(page.getByRole('button', { name: 'RECONNECT' })).toBeVisible();
});
test('production audio activation uses the native browser context only after Play', async ({ page }) => {
  const audioFiles: string[] = []; page.on('response', r => { if (r.url().endsWith('.ogg')) audioFiles.push(r.url()); });
  await page.addInitScript(() => { const Native = window.AudioContext; (window as any).__audioContexts = []; window.AudioContext = class extends Native { constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); (window as any).__audioContexts.push(this); } }; });
  await page.goto('/'); expect(await page.evaluate(() => (window as any).__audioContexts.length)).toBe(0);
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__audioContexts[0]?.state)).toBe('running');
  expect(audioFiles.length).toBe(8);
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__audioContexts[0]?.state)).toBe('suspended');
  // This verifies activation/state, not audible quality or speaker loudness.
});
test('low graphics changes the real drawing-buffer resolution and keeps the minimap on the left', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click(); await page.getByLabel('Graphics quality', { exact: true }).selectOption('low');
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  const buffer = await page.evaluate(() => { const c = document.querySelector<HTMLCanvasElement>('.world')!; return { width: c.width, css: c.clientWidth }; });
  expect(buffer.width).toBeLessThan(buffer.css); const map = await page.locator('.map-panel').boundingBox(); expect(map!.x).toBeLessThan(60);
});
test('production map settings, ring and hunter legend work without a fixture interface', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Hunter map visibility', { exact: true }).selectOption('arcade');
  await page.getByLabel('Minimap orientation', { exact: true }).selectOption('heading');
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect(page.locator('.map-heading')).toContainText('HEADING UP');
  await expect(page.locator('.map-knowledge')).toHaveText('ARCADE: ALL HUNTERS LIVE');
  await expect(page.locator('.wave-ring')).toHaveAttribute('aria-label', /SCATTER.*seconds remaining/);
  expect(await page.locator('.hunter-glyph').count()).toBe(4);
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(400); await page.keyboard.up('KeyJ');
  await page.screenshot({ path: `${outputDir}/phase2/production-map.png` });
  expect(await page.evaluate(() => typeof (window as any).__DC)).toBe('undefined');
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
});
