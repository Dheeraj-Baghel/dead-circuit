import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('remapping changes real input, survives reload, and never starts a run automatically', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Rebind forward', exact: true }).click(); await page.keyboard.press('KeyI');
  await expect(page.getByRole('button', { name: 'Rebind forward', exact: true })).toContainText('I');
  await page.getByLabel('Mute all audio', { exact: true }).check();
  await page.getByRole('button', { name: 'DONE' }).click(); await page.reload();
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('button', { name: 'Rebind forward', exact: true })).toContainText('I');
  await expect(page.getByLabel('Mute all audio', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  const before = await page.evaluate(() => (window as any).__DC.snapshot().position.z);
  await page.keyboard.down('KeyI'); await page.waitForTimeout(700); await page.keyboard.up('KeyI');
  expect(await page.evaluate(() => (window as any).__DC.snapshot().position.z)).toBeLessThan(before - 1);
});
test('tab blur clears input and freezes the chase until deliberate resume', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(300);
  const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront();
  await page.waitForTimeout(300); await page.bringToFront();
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  const before = await page.evaluate(() => (window as any).__DC.snapshot()); await page.waitForTimeout(400);
  expect((await page.evaluate(() => (window as any).__DC.snapshot())).time).toBe(before.time);
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await page.waitForTimeout(400);
  expect((await page.evaluate(() => (window as any).__DC.snapshot())).position.z).toBeCloseTo(before.position.z, 5);
  await other.close();
});
test('corrupt storage and unavailable mouse capture give useful states, not a crash', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('dead-circuit.save.v1', '{bad'); HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('test denied')); });
  await page.goto('/'); await expect(page.locator('.storage-warning')).toBeVisible();
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect(page.locator('.input-hint')).toContainText('Drag the scene');
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(300); await page.keyboard.up('KeyJ');
  expect(Math.abs(await page.evaluate(() => (window as any).__DC.snapshot().yaw))).toBeGreaterThan(.2);
});
test('WebGL context loss pauses and displays a recovery action', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => { const c = document.querySelector<HTMLCanvasElement>('.world')!; const gl = c.getContext('webgl2')!; gl.getExtension('WEBGL_lose_context')!.loseContext(); });
  await expect(page.getByRole('heading', { name: 'Signal unavailable.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RECONNECT' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DC.snapshot().mode)).toBe('paused');
});
for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }, { width: 812, height: 375 }]) {
  test(`menus stay operable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.screenshot({ path: `artifacts/testing/menu-${viewport.width}x${viewport.height}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const cta = await page.getByRole('button', { name: 'ENTER THE MAZE' }).boundingBox();
    expect(cta!.y + cta!.height).toBeLessThan(viewport.height);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeVisible();
  });
}
test('semantic menus, settings and paused controls have no detected WCAG A/AA violations', async ({ page }) => {
  const results: { surface: string; violations: unknown[] }[] = [];
  const check = async (surface: string) => { const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); results.push({ surface, violations: r.violations }); };
  await page.goto('/'); await check('menu');
  await page.getByRole('button', { name: 'Open settings' }).click(); await check('settings');
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'HOW TO SURVIVE' }).click(); await check('help');
  await page.getByRole('button', { name: 'UNDERSTOOD' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); await page.keyboard.press('Escape'); await check('pause');
  const { writeFile } = await import('node:fs/promises'); await writeFile('artifacts/testing/accessibility.json', JSON.stringify(results, null, 2));
  expect(results.flatMap(r => r.violations).map((v: any) => ({ id: v.id, nodes: v.nodes.map((n: any) => n.target) }))).toEqual([]);
});
test('practice taints records for the whole run even after switching it off', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Capture-free practice', { exact: false }).check();
  await page.getByLabel('Capture-free practice', { exact: false }).uncheck(); await page.getByRole('button', { name: 'DONE' }).click();
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await page.evaluate(() => (window as any).__DC.fixture('exit'));
  await expect(page.getByText('Practice run: no record or chapter unlock.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'NEXT TRANSMISSION' })).toHaveCount(0);
});
test('local progress reset is gated and preserves appearance settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v1', JSON.stringify({ version: 1, settings: { highContrast: true }, progress: { unlocked: 3, best: {} } })));
  await page.goto('/'); await page.getByRole('button', { name: 'CREDITS', exact: true }).click(); await page.getByRole('button', { name: 'RESET LOCAL PROGRESS' }).click();
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dead-circuit.save.v1')!).progress.unlocked)).toBe(3);
  await page.getByRole('button', { name: 'RESET LOCAL PROGRESS' }).click(); await page.getByRole('button', { name: 'ERASE LOCAL PROGRESS' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dead-circuit.save.v2')!)); expect(stored.progress.unlocked).toBe(1); expect(stored.settings.highContrast).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dead-circuit.save.v1')!).progress.unlocked)).toBe(3);
});
