import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const ART = 'artifacts/testing/phase4';
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__DC.snapshot());
const play = async (page: import('@playwright/test').Page) => { await page.goto('/'); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); };
test.beforeAll(() => mkdirSync(ART, { recursive: true }));
async function slider(page: import('@playwright/test').Page, label: string, steps: number) { const input = page.getByLabel(label, { exact: true }); await input.focus(); await input.press('Home'); for (let i = 0; i < steps; i++) await input.press('ArrowRight'); }
test('native audio waits for Play, decodes all local samples and emits a nonzero signal', async ({ page }) => {
  await page.goto('/'); expect((await snap(page)).sound.state).toBe('uncreated');
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click();
  await expect.poll(async () => (await snap(page)).sound.decoded).toBe(8);
  await expect.poll(async () => (await snap(page)).sound.rms).toBeGreaterThan(.0001);
  const sound = (await snap(page)).sound; expect(sound.state).toBe('running'); expect(sound.loops).toBe(5); expect(sound.failures).toEqual([]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW'); expect((await snap(page)).sound.started).toBeGreaterThan(0);
  writeFileSync(`${ART}/native-audio.json`, JSON.stringify({ evidence: (await snap(page)).sound, limitation: 'Native decoding, graph signal and lifecycle evidence only; not a human listening or calibrated loudness assessment.' }, null, 2));
});
test('separate music/ambience/effects gains persist and master mute silences the real graph', async ({ page }) => {
  await play(page); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click();
  await slider(page, 'Music volume', 4); await slider(page, 'Ambience volume', 6); await slider(page, 'Effects volume', 8);
  await page.getByLabel('Proximity heartbeat', { exact: false }).uncheck();
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'RESUME SIGNAL' }).click();
  await expect.poll(async () => (await snap(page)).sound.gains.music).toBeCloseTo(.2, 2);
  expect((await snap(page)).sound.gains.ambience).toBeCloseTo(.3, 2); expect((await snap(page)).sound.gains.effects).toBeCloseTo(.4, 2);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Mute all audio', { exact: true }).check();
  await page.screenshot({ path: `${ART}/audio-comfort-settings.png` }); await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'RESUME SIGNAL' }).click();
  await expect.poll(async () => (await snap(page)).sound.rms).toBeLessThan(.0001);
  await page.reload(); await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByLabel('Music volume', { exact: true })).toHaveValue('0.2'); await expect(page.getByLabel('Ambience volume', { exact: true })).toHaveValue('0.3'); await expect(page.getByLabel('Effects volume', { exact: true })).toHaveValue('0.4');
  await expect(page.getByLabel('Proximity heartbeat', { exact: false })).not.toBeChecked(); await expect(page.getByLabel('Mute all audio', { exact: true })).toBeChecked();
});
test('all authored cosmetic events have visible captions and explicit non-hunter rendering', async ({ page }) => {
  await play(page);
  for (const kind of ['lamp', 'screen', 'steps', 'silhouette', 'whisper']) {
    await page.evaluate(k => (window as any).__DC.fixture(`scare-${k}`), kind);
    await expect.poll(async () => (await snap(page)).scare?.kind).toBe(kind);
    await expect(page.locator('.sound-caption')).toContainText('ENVIRONMENT');
    const before = await snap(page); await page.waitForTimeout(500); const after = await snap(page);
    expect(after.renderer.atmosphere.kind).toBe(kind); expect(after.enemies).toHaveLength(4); expect(after.scare.id).toBe(before.scare.id);
    await page.screenshot({ path: `${ART}/event-${kind}.png` });
  }
});
test('pause freezes atmosphere and native audio; resume has no queued burst', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('scare-lamp')); await expect.poll(async () => (await snap(page)).scare?.kind).toBe('lamp');
  await page.keyboard.press('Escape'); await expect.poll(async () => (await snap(page)).sound.state).toBe('suspended');
  const before = await snap(page); await page.waitForTimeout(500); const after = await snap(page);
  expect(after.time).toBe(before.time); expect(after.scare).toEqual(before.scare); expect(after.sound.started).toBe(before.sound.started); expect(after.sound.voices).toBe(0);
  await page.getByRole('button', { name: 'RESUME SIGNAL' }).click(); await expect.poll(async () => (await snap(page)).sound.state).toBe('running');
  expect((await snap(page)).sound.started).toBeLessThanOrEqual(before.sound.started + 1);
});
test('Reduced Scares cancels active cosmetics and their captions immediately, including during pause', async ({ page }) => {
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('scare-silhouette')); await expect.poll(async () => (await snap(page)).renderer.atmosphere.silhouette).toBe(true);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).last().click(); await page.getByLabel('Reduced scare intensity', { exact: false }).check();
  expect((await snap(page)).scare).toBeNull(); expect((await snap(page)).sound.voices).toBe(0);
  await page.getByRole('button', { name: 'DONE' }).click(); await page.getByRole('button', { name: 'RESUME SIGNAL' }).click();
  await page.evaluate(() => (window as any).__DC.fixture('scare-screen')); await page.waitForTimeout(150);
  expect((await snap(page)).scare).toBeNull(); expect((await snap(page)).renderer.atmosphere.silhouette).toBe(false);
  await expect(page.locator('.sound-caption')).toHaveCount(0);
});
test('Reduced Motion excludes animated cosmetics and close pursuit prevents scares', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v2', JSON.stringify({ version: 2, settings: { reducedMotion: true } })));
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('scare-silhouette')); await page.waitForTimeout(150);
  expect(['steps', 'whisper']).toContain((await snap(page)).scare?.kind); expect((await snap(page)).renderer.atmosphere.silhouette).toBe(false);
  await page.evaluate(() => (window as any).__DC.fixture('scare-danger')); await page.waitForTimeout(150); expect((await snap(page)).scare).toBeNull();
});
test('missing samples use real synthesis fallback, while muted cues still retain captions', async ({ page }) => {
  await page.route('**/assets/audio/*.ogg', r => r.abort()); await play(page);
  await expect.poll(async () => (await snap(page)).sound.failures.length).toBe(8);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  expect((await snap(page)).sound.fallbackCount).toBeGreaterThan(0); expect((await snap(page)).sound.state).toBe('running');
  await page.evaluate(() => (window as any).__DC.fixture('scare-lamp')); await expect(page.locator('.sound-caption')).toContainText('lamp');
});
test('unsupported audio preserves a playable game and non-audio scare cue', async ({ page }) => {
  await page.addInitScript(() => { (window as any).AudioContext = class { constructor() { throw new Error('Audio unavailable for fixture'); } }; });
  await play(page); await expect(page.locator('.storage-warning')).toContainText('Audio could not start');
  await page.evaluate(() => (window as any).__DC.fixture('scare-lamp')); await expect(page.locator('.sound-caption')).toContainText('lamp');
  expect((await snap(page)).mode).toBe('playing'); expect((await snap(page)).sound.state).toBe('uncreated');
});
test('voice storms are bounded and retries reuse one context and five loops', async ({ page }) => {
  await page.addInitScript(() => { const Native = window.AudioContext; (window as any).__nativeContexts = []; window.AudioContext = class extends Native { constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); (window as any).__nativeContexts.push(this); } }; });
  await play(page); await page.evaluate(() => (window as any).__DC.fixture('audio-storm')); await page.waitForTimeout(100);
  expect((await snap(page)).sound.peakVoices).toBeLessThanOrEqual(14);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'RETURN TO MENU' }).click(); await page.getByRole('button', { name: 'ENTER THE MAZE' }).click(); await page.waitForTimeout(120); expect((await snap(page)).sound.loops).toBe(5); }
  expect(await page.evaluate(() => (window as any).__nativeContexts.length)).toBe(1);
});
