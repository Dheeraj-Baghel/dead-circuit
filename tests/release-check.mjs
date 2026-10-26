// Local release engineering only: validates built assets and runs bounded,
// fixture-free production smoke workflows on an owned ephemeral loopback port.
// No deployment, source mutation or reuse/termination of user preview servers.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url)), dist = resolve(root, 'dist'), out = resolve(root, 'artifacts/testing/phase5');
mkdirSync(out, { recursive: true });
const walk = dir => readdirSync(dir).flatMap(name => { const p = resolve(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = JSON.parse(readFileSync(resolve(root, 'asset-manifest.json'), 'utf8'));
const audit = { files: 0, hashes: 0, glbTextures: 0, bytes: 0, chunks: [], notices: [] };
for (const asset of manifest.externalAssets) {
  for (const file of asset.localFiles) { assert.ok(existsSync(resolve(root, file)), file); audit.files++; }
  assert.ok(existsSync(resolve(root, asset.notice)), asset.notice); audit.notices.push(asset.notice);
  for (const [name, expected] of Object.entries(asset.sha256 ?? {})) { const file = asset.localFiles.find(p => p.split('/').at(-1) === name); assert.ok(file, name); assert.equal(sha(resolve(root, file)), expected, name); audit.hashes++; }
  for (const file of asset.localFiles.filter(p => p.endsWith('.glb'))) {
    const bytes = readFileSync(resolve(root, file)); assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const image of json.images ?? []) if (image.uri && !image.uri.startsWith('data:')) {
      assert.ok(!/^https?:/.test(image.uri)); assert.ok(existsSync(resolve(root, file, '..', image.uri))); audit.glbTextures++;
    }
  }
}
for (const file of walk(dist)) {
  audit.bytes += statSync(file).size;
  const path = relative(dist, file); assert.ok(!/(^|\/)(asset-inbox|node_modules|tests|\.env)(\/|$)/.test(path), path);
  if (file.endsWith('.js')) { audit.chunks.push({ file: path, bytes: statSync(file).size }); assert.ok(statSync(file).size < 500000, path); assert.ok(!readFileSync(file, 'utf8').includes('__DC'), 'Development fixture namespace leaked'); }
}
assert.ok(audit.bytes < 20000000);
for (const marker of ['AMBIENTCG', 'KENNEY MINI ARCADE', 'KENNEY IMPACT SOUNDS']) assert.ok(readFileSync(resolve(dist, 'licenses.txt'), 'utf8').includes(marker));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  let file = resolve(dist, '.' + decodeURIComponent(pathname)); if (pathname === '/') file = resolve(dist, 'index.html');
  if (!file.startsWith(dist + '/') || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const results = [];
try {
  for (const [name, type, launch] of [['Chrome', chromium, { channel: 'chrome' }], ['WebKit', webkit, {}]]) {
    let browser;
    try {
      browser = await type.launch({ headless: true, timeout: 15000, ...launch });
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [], remote = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) remote.push(r.url()); });
      await page.addInitScript(() => { const Native = window.AudioContext; window.__releaseContexts = []; window.AudioContext = class extends Native { constructor(...args) { super(...args); window.__releaseContexts.push(this); } }; });
      await page.goto(base, { timeout: 20000 });
      if (await page.getByRole('heading', { name: 'Signal unavailable.' }).isVisible()) {
        results.push({ engine: name, version: browser.version(), status: 'fallback-only', reason: await page.locator('.dialog').innerText(), errors }); continue;
      }
      await page.getByRole('button', { name: 'ENTER THE MAZE' }).click({ timeout: 20000 });
      assert.equal(await page.evaluate(() => typeof window.__DC), 'undefined');
      await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('ArrowUp');
      assert.ok(Number(await page.locator('.memory-count').textContent()) > 0, 'Arrow input did not collect real memory');
      await page.keyboard.down('KeyJ'); await page.waitForTimeout(300); await page.keyboard.up('KeyJ');
      await page.screenshot({ path: resolve(out, `${name.toLowerCase()}-production.png`) });
      await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'RESUME SIGNAL' }).waitFor();
      const timer = await page.locator('.run-time').textContent(); await page.waitForTimeout(250); assert.equal(await page.locator('.run-time').textContent(), timer);
      const audio = await page.evaluate(() => window.__releaseContexts.map(c => c.state)); assert.ok(audio.every(s => s === 'suspended'));
      await page.getByRole('button', { name: 'ENLARGE MAP' }).click(); await page.getByLabel('Enlarged north-up maze map').waitFor();
      await page.screenshot({ path: resolve(out, `${name.toLowerCase()}-paused-map.png`) });
      assert.deepEqual(errors, []); assert.deepEqual(remote, []);
      results.push({ engine: name, version: browser.version(), status: 'passed', checks: ['local production loading', 'arrow movement and collection', 'J/L fallback turn input', 'pause and native audio suspension', 'enlarged map', 'no fixture API', 'no remote asset requests', 'no page errors'] });
    } catch (e) { results.push({ engine: name, status: 'blocked-or-failed', diagnostic: String(e.stack ?? e).slice(0, 4000) }); }
    finally { await browser?.close(); }
  }
} finally { await new Promise(r => server.close(r)); }
const report = { audit, browserSmoke: results, firefox: { status: 'not-qualified', reason: 'The cached Firefox availability probe could not launch in this environment; no full workflow is claimed.' }, limits: ['Automation is not human fairness, scare or audible-quality testing', 'Playwright WebKit is not physical Safari certification', 'No physical devices, long-session GPU or assistive-technology approval', 'No deployment performed'] };
writeFileSync(resolve(out, 'release-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (results.find(r => r.engine === 'Chrome')?.status !== 'passed') process.exitCode = 1;
