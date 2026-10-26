import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
test.beforeAll(() => mkdirSync('artifacts/testing/phase5', { recursive: true }));
const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
test('unreadable future save survives a preference change in a protected recovery copy', async ({ page }) => {
  const original = JSON.stringify({ version: 99, future: { unlocked: 'preserve original' } });
  await page.addInitScript(raw => { if (!localStorage.getItem('dead-circuit.save.v2')) localStorage.setItem('dead-circuit.save.v2', raw); }, original);
  await page.goto('/'); await expect(page.locator('.storage-warning')).toContainText('original is protected');
  await page.getByRole('button', { name: 'Open settings' }).click(); await page.getByLabel('Mute all audio', { exact: true }).check();
  expect(await page.evaluate(() => localStorage.getItem('dead-circuit.save.recovery'))).toBe(original);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dead-circuit.save.v2')!).version)).toBe(2);
  await page.reload(); expect(await page.evaluate(() => localStorage.getItem('dead-circuit.save.recovery'))).toBe(original);
  await page.getByRole('button', { name: 'Open settings' }).click(); await expect(page.getByLabel('Mute all audio', { exact: true })).toBeChecked();
});
test('native graphics context restore returns to deliberate pause with run state intact', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('.world')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_lose_context')!;
    (window as any).__restoreGraphics = () => ext.restoreContext(); ext.loseContext();
  });
  await expect(page.getByRole('heading', { name: 'Signal unavailable.' })).toBeVisible(); const paused = await snapshot(page);
  await page.evaluate(() => (window as any).__restoreGraphics());
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  const restored = await snapshot(page); expect(restored.mode).toBe('paused'); expect(restored.position).toEqual(paused.position); expect(restored.time).toBe(paused.time); expect(restored.score).toBe(paused.score);
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click();
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(250); await page.keyboard.up('KeyJ');
  const running = await snapshot(page); expect(running.mode).toBe('playing'); expect(running.renderer.calls).toBeGreaterThan(0); expect(running.time).toBeGreaterThan(paused.time);
  await page.screenshot({ path: 'artifacts/testing/phase5/context-restored.png' }); expect(errors).toEqual([]);
});
test('pause shows capture cooldown then reacquires the native mouse lock on Resume', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === document.querySelector('.world'))).toBe(true);
  await page.keyboard.press('Escape'); const resume = page.getByRole('button', { name: 'RESUME SIGNAL' });
  await expect(page.locator('.capture-cooldown')).toBeVisible();
  await expect(resume).toBeEnabled(); await resume.click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === document.querySelector('.world'))).toBe(true);
});
