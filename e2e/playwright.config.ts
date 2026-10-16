import { defineConfig, devices } from '@playwright/test';

/** Em ambientes sem download de navegador, aponte para um Chromium já instalado (ex.: /opt/pw-browsers/chromium-1194/chrome-linux/chrome). */
const chromium = process.env.E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } } : {};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...chromium },
    },
    {
      // Telas estreitas: a folha de seleção do combobox só existe aqui (≤ 860px).
      name: 'mobile',
      testMatch: /combobox\.spec\.ts/,
      use: { ...devices['Pixel 7'], ...chromium },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'cd ../frontend && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
