import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @telumi/api dev',
      url: 'http://localhost:3001/v1/health',
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @telumi/admin-web dev',
      url: 'http://localhost:3000/login',
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @telumi/player dev',
      url: 'http://localhost:3002',
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
