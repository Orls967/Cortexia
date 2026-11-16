import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.CORTEXIA_LIVE_URL ?? 'https://orls967.github.io/Cortexia/',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
    },
  },
  projects: [
    { name: 'desktop-live', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
