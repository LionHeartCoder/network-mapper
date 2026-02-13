import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // E2E cleanup endpoint is global (prefix-based), so run serially to avoid cross-file fixture races.
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // Retry flaky tests up to 2 times in CI to reduce transient failures.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000',
    trace: 'retain-on-failure',
    // Stable launch options for CI
    headless: true,
    actionTimeout: 30_000,
  },
  reporter: [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]],
});
