// Reproducibility gate in a disposable isolated copy, never removing the user's
// active node_modules or interrupting the local game preview.
import { mkdtempSync, cpSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url)), temp = mkdtempSync(resolve(tmpdir(), 'dead-circuit-clean-'));
const out = resolve(root, 'artifacts/testing/phase5'); mkdirSync(out, { recursive: true });
const report = { node: process.version, lockSha256: createHash('sha256').update(readFileSync(resolve(root, 'package-lock.json'))).digest('hex'), isolated: true, stages: [], cleaned: false };
let failed = false;
try {
  for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'src', 'public', 'tests']) cpSync(resolve(root, path), resolve(temp, path), { recursive: true });
  for (const args of [['ci', '--no-fund'], ['test'], ['run', 'build']]) {
    const result = spawnSync('npm', args, { cwd: temp, env: process.env, encoding: 'utf8', timeout: 150000 });
    const stage = { command: `npm ${args.join(' ')}`, status: result.status, error: result.error?.message ?? null, stdout: result.stdout?.slice(-22000), stderr: result.stderr?.slice(-8000) };
    report.stages.push(stage); console.log(stage.command, 'status', stage.status); console.log(stage.stdout ?? '');
    if (stage.status !== 0) { failed = true; break; }
  }
} finally { rmSync(temp, { recursive: true, force: true }); report.cleaned = true; }
writeFileSync(resolve(out, 'clean-install.json'), JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
