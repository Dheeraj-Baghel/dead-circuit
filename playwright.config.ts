import { defineConfig } from '@playwright/test';
// Hosted checks must use only the fixture-free production suite. The other
// workflows intentionally require DEV-only hooks and must never target a release.
const deployment = process.env.DC_DEPLOYMENT_URL;
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 45000,
  testMatch: deployment ? 'production.spec.ts' : undefined,
  use: { baseURL: process.env.DC_TEST_BASE_URL || 'http://127.0.0.1:4332', browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
    screenshot: 'only-on-failure' },
  reporter: [['list'], ['json', { outputFile: deployment ? 'artifacts/testing/live/browser-results.json' : 'artifacts/testing/browser-results.json' }]],
  webServer: deployment ? undefined : [
    { command: 'npm run dev', url: 'http://127.0.0.1:4332', reuseExistingServer: !process.env.CI, timeout: 30000 },
    { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4333 --strictPort', url: 'http://127.0.0.1:4333', reuseExistingServer: false, timeout: 60000 },
  ],
});
