import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
const play = async (page: import('@playwright/test').Page) => { await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); };
test.beforeAll(() => mkdirSync('artifacts/testing/phase5', { recursive: true }));
test('all arrow keys move camera-relatively and do not rotate the camera', async ({ page }) => {
  await play(page);
  for (const [code, axis, sign] of [['ArrowUp', 'z', -1], ['ArrowDown', 'z', 1], ['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1]] as const) {
    await page.evaluate(() => (window as any).__DC.fixture('controls')); const before = await snap(page);
    await page.keyboard.down(code); await page.waitForTimeout(350); await page.keyboard.up(code); const after = await snap(page);
    expect((after.position[axis] - before.position[axis]) * sign).toBeGreaterThan(.5);
    expect(after.yaw).toBeCloseTo(before.yaw, 6);
  }
  await page.screenshot({ path: 'artifacts/testing/phase5/arrow-movement.png' });
});
test('W plus Up remains one input and diagonal arrows stay normalized', async ({ page }) => {
  await play(page);
  for (const keys of [['KeyW', 'ArrowUp'], ['ArrowUp', 'ArrowRight']]) {
    await page.evaluate(() => (window as any).__DC.fixture('controls')); const before = await snap(page);
    for (const key of keys) await page.keyboard.down(key); await page.waitForTimeout(250); for (const key of keys) await page.keyboard.up(key);
    const after = await snap(page), travel = Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z);
    expect(travel).toBeGreaterThan(.3); expect(travel).toBeLessThanOrEqual(3.2 * (after.time - before.time) + .08);
  }
});
test('J/L still turn without mouse capture and arrows still move', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('fixture denied')); });
  await play(page); await expect(page.locator('.input-hint')).toContainText('J / L');
  await page.evaluate(() => (window as any).__DC.fixture('controls'));
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(250); await page.keyboard.up('KeyJ');
  expect((await snap(page)).yaw).toBeGreaterThan(.2);
  await page.keyboard.down('KeyL'); await page.waitForTimeout(250); await page.keyboard.up('KeyL');
  const before = await snap(page); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
  expect((await snap(page)).position.z).toBeLessThan(before.position.z - .4);
});
test('arrow holds clear on tab loss and do not leak through resume or sliders', async ({ page, context }) => {
  await play(page); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(150);
  const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.waitForTimeout(100); await page.bringToFront();
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible(); const before = await snap(page);
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Music volume', { exact: true }).focus(); await page.keyboard.press('ArrowRight');
  expect((await snap(page)).position).toEqual(before.position);
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await page.waitForTimeout(250);
  expect((await snap(page)).position).toEqual(before.position); await page.keyboard.up('ArrowUp'); await other.close();
});
test('reserved input bindings are explained and old conflicts repair without progress loss', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, settings: { bindings: { radar: 'ArrowUp', flashlight: 'KeyJ' } }, progress: { unlocked: 3 } })));
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('button', { name: 'Rebind radar', exact: true })).toContainText('Q');
  await page.getByRole('button', { name: 'Rebind radar', exact: true }).click(); await page.keyboard.press('ArrowUp');
  await expect(page.locator('.setting-hint')).toContainText('Arrow keys move'); await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Control the fear.' })).toBeVisible(); await page.getByRole('button', { name: 'DONE' }).click();
  await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click(); await expect(page.getByRole('button', { name: /03 The Core/ })).toBeEnabled();
});
