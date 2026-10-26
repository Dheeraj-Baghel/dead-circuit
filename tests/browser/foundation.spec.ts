import { test, expect } from '@playwright/test';
test('fresh title, 3D canvas, left minimap and deliberate pause', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/testing/foundation-menu.png' });
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect(page.getByRole('complementary', { name: 'Left-side maze minimap' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'RESUME SIGNAL' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/testing/foundation-pause.png' });
  expect(errors).toEqual([]);
});
test('keyboard movement collects real memory and displays the left map', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2400); await page.keyboard.up('KeyW');
  await expect(page.locator('.memory-count')).not.toHaveText('0');
  await page.keyboard.press('KeyQ'); await expect(page.locator('.radar-status')).not.toContainText('READY');
  await page.screenshot({ path: 'artifacts/testing/arcade-gameplay.png' });
  const box = await page.locator('.map-panel').boundingBox(); expect(box!.x).toBeLessThan(80);
  expect(errors).toEqual([]);
});
