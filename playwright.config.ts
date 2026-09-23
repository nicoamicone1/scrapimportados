import { defineConfig, devices } from "@playwright/test";

/*
 * Smoke tests E2E del sitio público de la plataforma (landing, planes,
 * legales, ayuda, guías). Corren contra un `next start` del build ya hecho:
 * primero `next build` (con NEXT_DIST_DIR si usás otro dir) y después
 * `npm run e2e`. Ver README › "CI y E2E".
 *
 * PW_CHROMIUM: ruta a un Chromium ya instalado (ej. /opt/pw-browsers/chromium
 * en contenedores sin descarga de navegadores). En CI no se define y se usa
 * el que baja `npx playwright install --with-deps chromium`.
 * E2E_PORT: puerto del `next start` (3111 por defecto; cambialo si ya está
 * ocupado por otro server, porque fuera de CI se reutiliza el que encuentre).
 */
const PORT = Number(process.env.E2E_PORT) || 3111;
const baseURL = `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        userAgent: devices["Pixel 7"].userAgent,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
