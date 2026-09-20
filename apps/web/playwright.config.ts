import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    headless: true
  },
  webServer: [
    {
      command: 'pnpm --filter @rummy/server dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: false,
      timeout: 25000
    },
    {
      command: 'pnpm --filter @rummy/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 25000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
