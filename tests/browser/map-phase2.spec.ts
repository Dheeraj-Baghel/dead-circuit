import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
const ART = 'artifacts/testing/phase2';
const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
test.beforeAll(() => mkdirSync(ART, { recursive: true }));
async function play(page: import('@playwright/test').Page) { await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); }
test('map controls persist without changing paused game state', async ({ page }) => {
  await play(page); await page.keyboard.press('Escape'); const before = await snapshot(page);
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click();
  await page.getByLabel('Hunter map visibility', { exact: true }).selectOption('arcade');
  await page.getByLabel('Minimap orientation', { exact: true }).selectOption('heading');
  await page.getByLabel('High-contrast minimap', { exact: true }).check(); await page.getByRole('button', { name: 'DONE' }).click();
  const after = await snapshot(page); expect(after.time).toBe(before.time); expect(after.score).toBe(before.score); expect(after.position).toEqual(before.position);
  expect(after.markers).toHaveLength(4); expect(after.markers.every((m: any) => m.source === 'arcade')).toBe(true);
  await expect(page.locator('.map-heading')).toContainText('HEADING UP');
  await page.reload(); await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByLabel('Hunter map visibility', { exact: true })).toHaveValue('arcade');
  await expect(page.getByLabel('Minimap orientation', { exact: true })).toHaveValue('heading');
  await expect(page.getByLabel('High-contrast minimap', { exact: true })).toBeChecked();
});
test('confirmed map distinguishes sight, stale fixes, heard estimates and wisps', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('map-knowledge'));
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  await expect(page.locator('[data-hunter="Stalker"]')).toHaveAttribute('data-source', 'sight');
  await expect(page.locator('[data-hunter="Mimic"]')).toHaveAttribute('data-source', 'heard');
  await expect(page.locator('[data-hunter="Puppet"]')).toHaveAttribute('data-source', 'last-seen');
  await expect(page.locator('[data-hunter="Weeper"]')).toContainText('RETURNING WISP');
  const before = await snapshot(page); await page.waitForTimeout(300); expect((await snapshot(page)).markers).toEqual(before.markers);
  await page.getByRole('button', { name: 'ENLARGE MAP' }).click();
  await expect(page.getByLabel('Enlarged north-up maze map')).toBeVisible();
  await expect(page.locator('.large-hunter-key')).toContainText('LAST SEEN');
  await expect(page.locator('.large-hunter-key')).toContainText('HEARD / ESTIMATE');
  await page.screenshot({ path: `${ART}/enlarged-observations.png` });
});
test('Arcade map heading mode responds to actual keyboard turning and keeps map north reference', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, settings: { mapVisibility: 'arcade', mapOrientation: 'heading' } })));
  await play(page); const before = await snapshot(page);
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(450); await page.keyboard.up('KeyJ');
  expect((await snapshot(page)).yaw).toBeGreaterThan(before.yaw + .4);
  await expect(page.locator('.map-heading')).toContainText('HEADING UP');
  await expect(page.locator('.map-knowledge')).toHaveText('ARCADE: ALL HUNTERS LIVE');
  expect(await page.locator('.hunter-glyph').count()).toBe(4);
  await page.screenshot({ path: `${ART}/heading-arcade.png` });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'ENLARGE MAP' }).click();
  await expect(page.getByLabel('Enlarged north-up maze map')).toBeVisible();
});
test('map, ring and enlarge action stay inside the viewport at maximum map scale', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, settings: { mapScale: 1.35, mapVisibility: 'arcade' } })));
  await play(page);
  for (const [width, height] of [[1440, 900], [1280, 720], [768, 1024], [390, 844], [320, 568], [812, 375]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
    const panel = await page.locator('.map-panel').boundingBox(), map = await page.locator('.map-viewport').boundingBox(), enlarge = await page.getByRole('button', { name: 'Enlarge minimap' }).boundingBox();
    expect(panel!.x).toBeLessThan(60); expect(panel!.y + panel!.height).toBeLessThan(height - 40);
    expect(map!.y + map!.height).toBeLessThanOrEqual(panel!.y + panel!.height - 5);
    expect(enlarge!.y + enlarge!.height).toBeLessThanOrEqual(panel!.y + panel!.height - 5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${ART}/max-map-${width}x${height}.png` });
  }
});
test('map renders objective colors, house and power cells from the shared grid', async ({ page }) => {
  await play(page);
  const pixels = await page.locator('.map-viewport canvas').evaluate((c: HTMLCanvasElement) => {
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const counts: Record<string, number> = {};
    for (let i = 0; i < data.length; i += 4) { const rgb = `${data[i]},${data[i + 1]},${data[i + 2]}`; counts[rgb] = (counts[rgb] ?? 0) + 1; }
    return counts;
  });
  expect(pixels['84,59,70']).toBeGreaterThan(30); // H cells, not playable floor.
  expect(pixels['164,240,213']).toBeGreaterThan(10); // Four green power cells.
  expect(pixels['245,214,154']).toBeGreaterThan(50); // Remaining motes.
  await expect(page.getByRole('progressbar', { name: 'Memory recovered' })).toHaveAttribute('aria-valuenow', '0');
});
test('new map settings and enlarged legend have no detected A/AA accessibility violations', async ({ page }) => {
  await play(page); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'ENLARGE MAP' }).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
