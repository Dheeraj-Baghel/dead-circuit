import { test, expect } from '@playwright/test';
const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
// Fixture setups below use the live simulation and actual keyboard movement.
// They do not claim human playthroughs; production has no fixture API.
test('native run advances scatter/chase and releases the four hunters', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  expect((await snapshot(page)).enemies.map((e: any) => e.kind)).toEqual(['Stalker', 'Mimic', 'Puppet', 'Weeper']);
  await expect(page.locator('.wave-status')).toContainText('SCATTER');
  await expect.poll(async () => (await snapshot(page)).wave, { timeout: 14000 }).toBe('chase');
  await expect.poll(async () => (await snapshot(page)).enemies.some((e: any) => e.state === 'locked'), { timeout: 16000 }).toBe(false);
  await page.keyboard.press('Escape'); const before = await snapshot(page); await page.waitForTimeout(250);
  expect((await snapshot(page)).time).toBe(before.time);
});
test('keyboard tunnel wrap changes side without collecting or hitting across the maze', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('tunnel')); const before = await snapshot(page);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(400); await page.keyboard.up('KeyA');
  const after = await snapshot(page); expect(before.position.x).toBeLessThan(1); expect(after.position.x).toBeGreaterThan(57);
  expect(after.remaining).toBe(before.remaining); expect(after.lives).toBe(before.lives);
  await page.screenshot({ path: 'artifacts/testing/v2-phase1-tunnel.png' }); expect(errors).toEqual([]);
});
test('player is blocked by the visible Lockup gate', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('lockup'));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position.z).toBeLessThan(9 * 2.8);
  await page.screenshot({ path: 'artifacts/testing/v2-phase1-lockup.png' });
});
test('last mote activates blackout and final dash in the live renderer', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('blackout'));
  await expect(page.locator('.wave-status')).toHaveText('BLACKOUT / FINAL DASH');
  expect((await snapshot(page)).remaining).toBe(0); expect((await snapshot(page)).overload).toBe(0);
  await expect(page.locator('.objective strong')).toHaveText('Get to the exit.');
  await page.screenshot({ path: 'artifacts/testing/v2-phase1-blackout.png' });
});
test('relic and extra-life rule update the HUD and stop on pause', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('relic-life'));
  await expect(page.locator('.lives')).toHaveAttribute('aria-label', '4 chances remaining');
  await expect(page.locator('.relic-status')).toContainText('Arcade token');
  await page.keyboard.press('Escape'); const text = await page.locator('.relic-status').textContent();
  await page.waitForTimeout(500); expect(await page.locator('.relic-status').textContent()).toBe(text);
});
test('Night Shift unlocks on campaign completion, continues and persists separate bests', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await expect(page.getByRole('button', { name: /Night Shift/ })).toBeDisabled();
  await page.getByRole('button', { name: /01 The Service Loop/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__DC.fixture('exit'));
    if (i < 2) await page.getByRole('button', { name: 'NEXT TRANSMISSION' }).click();
    else await expect(page.getByRole('heading', { name: 'The signal is yours.' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'RETURN TO MENU' }).click();
  await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click(); await page.getByRole('button', { name: /Night Shift/ }).click();
  await expect(page.locator('.objective .eyebrow')).toHaveText('NIGHT SHIFT / 1');
  await page.evaluate(() => (window as any).__DC.fixture('exit')); await expect(page.getByRole('button', { name: 'NEXT NIGHT' })).toBeVisible();
  const previous = await snapshot(page); await page.getByRole('button', { name: 'NEXT NIGHT' }).click();
  const next = await snapshot(page); expect(next.night).toBe(2); expect(next.score).toBe(previous.score); expect(next.lives).toBe(previous.lives);
  await page.evaluate(() => (window as any).__DC.fixture('exit')); await expect(page.getByRole('button', { name: 'NEXT NIGHT' })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await expect(page.getByRole('button', { name: /Night Shift/ })).toContainText('BEST NIGHT 2');
});
