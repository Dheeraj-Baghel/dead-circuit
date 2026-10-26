import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
test('bounded renderer workload in a four-hunter stress scene and repeated retries', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dead-circuit.save.v1', JSON.stringify({ version: 1, progress: { unlocked: 3, best: {} } })));
  await page.goto('/'); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click(); await page.getByRole('button', { name: /03 The Core/ }).click();
  await page.evaluate(() => (window as any).__DC.fixture('stress')); await page.waitForTimeout(400);
  await page.screenshot({ path: 'artifacts/testing/stress-core.png' });
  const sample = await page.evaluate(async () => {
    const samples: number[] = []; let previous = performance.now();
    for (let i = 0; i < 150; i++) { const now = await new Promise<number>(r => requestAnimationFrame(r)); samples.push(now - previous); previous = now; }
    const sorted = [...samples].sort((a, b) => a - b), gl = document.querySelector<HTMLCanvasElement>('.world')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { meanFps: 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length), p95FrameMs: sorted[Math.floor(sorted.length * .95)], sampleFrames: samples.length,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', workload: (window as any).__DC.snapshot().renderer };
  });
  expect(sample.meanFps).toBeGreaterThan(30); expect(sample.workload.calls).toBeLessThan(120); expect(sample.workload.triangles).toBeLessThan(250000);
  const memory: unknown[] = [sample.workload];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'RETURN TO MENU' }).click(); await page.getByRole('button', { name: 'TRANSMISSIONS', exact: true }).click(); await page.getByRole('button', { name: /03 The Core/ }).click(); await page.waitForTimeout(150); memory.push(await page.evaluate(() => (window as any).__DC.snapshot().renderer)); }
  const first = memory[1] as any, last = memory.at(-1) as any; expect(last.geometries).toBeLessThanOrEqual(first.geometries + 2); expect(last.textures).toBeLessThanOrEqual(first.textures + 2);
  await writeFile('artifacts/testing/performance.json', JSON.stringify({ environment: { cpu: os.cpus()[0]?.model, platform: os.platform(), arch: os.arch(), viewport: { width: 1440, height: 900 }, headless: true, quality: 'standard', browser: 'Chrome', scenario: 'v2 Phase 1 development build; four hunters, radar, overload, restored relay; controlled fixture, not human gameplay' }, ...sample, retryRendererInventory: memory, limitations: ['Short headless sample, not field/device FPS', 'No audible quality assessment', 'Renderer resource counts are not a whole-JS-heap leak proof'] }, null, 2));
});
