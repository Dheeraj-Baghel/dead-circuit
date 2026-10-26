import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const ART = 'artifacts/testing/third-person';
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
const play = async (page: import('@playwright/test').Page) => { await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); };
test.beforeAll(() => mkdirSync(ART, { recursive: true }));
test('actual uploaded GLB is loaded, normalized inside its collider, and its jaw bones animate', async ({ page }) => {
  const files: string[] = []; page.on('response', r => { if (r.url().endsWith('/player/pacman_animated.glb')) files.push(r.url()); });
  await play(page); const before = await snap(page);
  expect(files).toHaveLength(1); expect(before.renderer.camera.mode).toBe('third');
  expect(before.renderer.player).toMatchObject({ loaded: true, visible: true, clip: 'Eating', triangles: 30204, sampledKeys: 41 });
  expect(before.renderer.player.duration).toBeCloseTo(.833333, 5);
  expect(before.renderer.player.visualRadius).toBeLessThan(before.renderer.player.collisionRadius);
  const pose = before.renderer.player.jaw; await page.waitForTimeout(310); const after = await snap(page);
  expect(after.renderer.player.animationTime).toBeGreaterThan(before.renderer.player.animationTime);
  expect(after.renderer.player.jaw).not.toEqual(pose);
  await page.screenshot({ path: `${ART}/spawn-mouth.png` });
  writeFileSync(`${ART}/runtime-player.json`, JSON.stringify({ before: before.renderer.player, after: after.renderer.player, note: 'Real uploaded skinned geometry and Eating bone poses; not a static replacement.' }, null, 2));
});
test('arrows move the visible body and turn it into the direction of travel without changing the camera yaw', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('controls'));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const s = await snap(page); expect(s.renderer.player.heading).toBeCloseTo(Math.PI / 2, 3); expect(s.yaw).toBe(0);
  expect(Math.abs(s.renderer.player.position[0] - s.position.x)).toBeLessThan(.07);
  expect(s.renderer.player.visible).toBe(true);
  const camera = s.renderer.camera.position;
  expect(await page.evaluate(async c => { const movementPath = '/src/game/movement.ts', levelsPath = '/src/game/levels.ts'; const { collides } = await import(movementPath); const { LEVELS } = await import(levelsPath); return collides(LEVELS[0], { x: c[0], z: c[2] }, .16); }, camera)).toBe(false);
  await page.screenshot({ path: `${ART}/moving-player.png` });
});
test('mouth pose and animation clock freeze while paused and resume only on explicit action', async ({ page }) => {
  await play(page); await page.waitForTimeout(200); await page.keyboard.press('Escape');
  const before = await snap(page); await page.waitForTimeout(450); const after = await snap(page);
  expect(after.renderer.player.jaw).toEqual(before.renderer.player.jaw); expect(after.renderer.player.animationTime).toBe(before.renderer.player.animationTime); expect(after.time).toBe(before.time);
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await page.waitForTimeout(220);
  expect((await snap(page)).renderer.player.animationTime).toBeGreaterThan(after.renderer.player.animationTime);
});
test('first-person fallback can be selected, persists and does not change the paused run', async ({ page }) => {
  await play(page); await page.keyboard.press('Escape'); const before = await snap(page);
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Camera view', { exact: true }).selectOption('first');
  await page.getByRole('button', { name: 'DONE' }).click();
  const first = await snap(page); expect(first.renderer.camera.mode).toBe('first'); expect(first.renderer.player.visible).toBe(false); expect(first.position).toEqual(before.position); expect(first.score).toBe(before.score);
  await page.reload(); await page.getByRole('button', { name: 'Open settings' }).click(); await expect(page.getByLabel('Camera view', { exact: true })).toHaveValue('first');
  await page.getByLabel('Camera view', { exact: true }).selectOption('third'); await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  expect((await snap(page)).renderer.player.visible).toBe(true);
});
test('tunnel warp keeps the follow camera local and never sweeps it across the maze', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('tunnel'));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
  const s = await snap(page), c = s.renderer.camera.position;
  expect(s.position.x).toBeGreaterThan(57); expect(Math.hypot(c[0] - s.position.x, c[2] - s.position.z)).toBeLessThan(2.1);
  expect(Math.abs(s.renderer.player.position[0] - s.position.x)).toBeLessThan(.07);
});
test('missing required player model gives an honest retry state, not a static substitute', async ({ page }) => {
  await page.route('**/assets/player/pacman_animated.glb', r => r.abort()); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Signal unavailable.' })).toBeVisible();
  await expect(page.getByText('The animated player model could not load', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RECONNECT' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toHaveCount(0);
});
