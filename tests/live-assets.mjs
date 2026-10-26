// Anonymous production packaging check: every runtime public asset must match
// local bytes. Catches excluded GLBs even when the app shell returns HTTP 200.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.DC_DEPLOYMENT_URL;
assert.ok(base, 'Set DC_DEPLOYMENT_URL to the deployed origin');
const origin = new URL(base).origin;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const get = async pathname => fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(30000) });
const walk = async dir => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(p)); else files.push(p);
  }
  return files;
};
const results = { origin, when: new Date().toISOString(), publicAssets: [], bundles: [], privatePaths: [], headers: {} };
const home = await get('/'); assert.equal(home.status, 200);
for (const [key, value] of Object.entries({ 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' })) {
  results.headers[key] = home.headers.get(key); assert.equal(results.headers[key], value);
}
assert.ok(home.headers.get('strict-transport-security'));
const html = await home.text(); assert.ok(html.includes('DEAD CIRCUIT'));
for (const file of await walk(path.join(root, 'public'))) {
  const url = '/' + path.relative(path.join(root, 'public'), file).split(path.sep).join('/');
  const response = await get(url); assert.equal(response.status, 200, url);
  const served = Buffer.from(await response.arrayBuffer()), local = await readFile(file);
  assert.equal(hash(served), hash(local), `Byte mismatch: ${url}`);
  results.publicAssets.push({ url, bytes: served.length, sha256: hash(served), status: response.status });
}
// Check all built JS/CSS chunks, not just entry files, and ensure DEV hooks are absent.
for (const file of (await walk(path.join(root, 'dist/assets'))).filter(p => /\.(js|css)$/.test(p))) {
  const url = '/' + path.relative(path.join(root, 'dist'), file).split(path.sep).join('/');
  const response = await get(url); assert.equal(response.status, 200, url);
  const served = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(served), hash(await readFile(file)), url);
  if (file.endsWith('.js')) assert.ok(!served.toString().includes('__DC'), `DEV hook in ${url}`);
  results.bundles.push({ url, bytes: served.length, status: response.status });
}
for (const url of ['/.env.local', '/.vercel/project.json', '/src/main.tsx', '/node_modules/react/package.json', '/asset-inbox/player/animated-pacman-api.json', '/pacman_animated.glb', '/does-not-exist']) {
  const response = await get(url); assert.equal(response.status, 404, url);
  results.privatePaths.push({ url, status: response.status });
}
const out = path.join(root, 'artifacts/testing/live'); await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'http-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`PASS ${results.publicAssets.length} byte-exact public assets, ${results.bundles.length} JS/CSS chunks, ${results.privatePaths.length} private/unknown 404s, security headers`);
