import { test, expect } from '@playwright/test';
const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
test('optional relay opens shared scene/map/collision topology and retry cleans its resources', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('relay')); await page.keyboard.press('KeyE');
  await expect(page.locator('.game-notice')).toContainText('maintenance shortcut');
  await page.screenshot({ path: 'artifacts/testing/relay-shortcut.png' });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'RETURN TO MENU' }).click();
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); expect(errors).toEqual([]);
});
test('original creature is rendered and telegraphed in a real corridor', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('encounter')); await page.waitForTimeout(500);
  await expect(page.locator('.threat-caption')).toContainText('STALKER / AHEAD');
  await page.screenshot({ path: 'artifacts/testing/horror-encounter.png' });
  const stats = (await snapshot(page)).renderer; expect(stats.calls).toBeLessThan(120); expect(stats.triangles).toBeLessThan(250000);
});
test('overload, capture and recovery use real simulation transitions', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('power'));
  await expect(page.locator('.power-status')).toContainText('OVERLOAD ACTIVE');
  await page.screenshot({ path: 'artifacts/testing/horror-overload.png' });
  await page.evaluate(() => (window as any).__DC.fixture('capture'));
  await expect(page.getByRole('button', { name: 'RECOVER SIGNAL' })).toBeVisible();
  expect((await snapshot(page)).lives).toBe(2);
  await page.screenshot({ path: 'artifacts/testing/horror-capture.png' });
  await page.getByRole('button', { name: 'RECOVER SIGNAL' }).click();
  await expect(page.locator('.objective')).toContainText('Recover the memory');
  expect((await snapshot(page)).mode).toBe('playing');
});
test('pause freezes all game-time resources and settings preserve the pause', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.keyboard.press('KeyQ'); await page.keyboard.press('Escape');
  const before = await snapshot(page); await page.waitForTimeout(700); const after = await snapshot(page);
  expect(after.time).toBe(before.time); expect(after.radar).toBe(before.radar);
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Control the fear.' })).toBeVisible();
  await page.getByLabel('Reduced motion', { exact: false }).check();
  await page.getByLabel('Reduced scare intensity', { exact: false }).check();
  await page.getByLabel('High-contrast minimap', { exact: true }).check();
  await page.screenshot({ path: 'artifacts/testing/horror-settings.png' });
  await page.getByRole('button', { name: 'DONE' }).click();
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  expect((await snapshot(page)).time).toBe(before.time);
});
test('large map stays north-up and resume requires a click', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'ENLARGE MAP' }).click();
  await expect(page.getByLabel('Enlarged north-up maze map')).toBeVisible();
  await page.getByRole('button', { name: 'BACK TO PAUSE' }).click();
  expect((await snapshot(page)).mode).toBe('paused');
});
