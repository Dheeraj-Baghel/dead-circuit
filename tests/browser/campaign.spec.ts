import { test, expect } from '@playwright/test';
test('chapter gates, next-chapter flow, and ending work with controlled completion fixtures', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await expect(page.getByRole('button', { name: /02 The Drainworks/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /03 The Core/ })).toBeDisabled();
  await page.getByRole('button', { name: /01 The Service Loop/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__DC.fixture('exit'));
    await expect(page.getByRole('heading', { name: i === 2 ? 'The signal is yours.' : 'You made it through.' })).toBeVisible();
    await page.screenshot({ path: `artifacts/testing/chapter-${i + 1}-complete.png` });
    if (i < 2) { await page.getByRole('button', { name: 'NEXT TRANSMISSION' }).click(); await page.screenshot({ path: `artifacts/testing/chapter-${i + 2}-entry.png` }); }
  }
  await page.getByRole('button', { name: 'RETURN TO MENU' }).click();
  await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await expect(page.getByRole('button', { name: /03 The Core/ })).toBeEnabled();
  expect(errors).toEqual([]);
});
test('training does not unlock chapters or create records', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await page.getByRole('button', { name: /00 Service Entry/ }).click(); await expect(page.locator('.practice-label')).toBeVisible();
  await page.evaluate(() => (window as any).__DC.fixture('exit'));
  await expect(page.getByRole('button', { name: 'ENTER FIRST CHAPTER' })).toBeVisible();
  await page.getByRole('button', { name: 'RETURN TO MENU' }).click();
  await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click();
  await expect(page.getByRole('button', { name: /02 The Drainworks/ })).toBeDisabled();
});
