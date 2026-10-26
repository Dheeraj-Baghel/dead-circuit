import { defineConfig } from 'vitest/config';

// Separate origin/port; never touches or deploys other workspace applications.
export default defineConfig({
  server: { host: '127.0.0.1', port: 4332, strictPort: true },
  preview: { host: '127.0.0.1', port: 4332, strictPort: true },
  // Separate cacheable renderer/UI libraries without raising or suppressing
  // the chunk warning. Rolldown keeps module dependency ordering intact.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'three', test: /node_modules\/three\//, maxSize: 400000 },
    { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\//, maxSize: 350000 },
  ] } } } },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
