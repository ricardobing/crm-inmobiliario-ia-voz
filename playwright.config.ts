import { defineConfig, devices } from "@playwright/test";

// E2E en navegador real. Con Chrome instalado: PW_CHANNEL=chrome pnpm test:e2e (no descarga navegadores).
// Sin Chrome: pnpm exec playwright install chromium y después pnpm test:e2e.
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // El servidor de desarrollo compila bajo demanda: pocos workers evitan timeouts falsos.
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || undefined,
    locale: "es-ES",
    // El navegador en otra zona horaria no debe cambiar las horas: se muestran en la de la organización (D06).
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/contacts`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
