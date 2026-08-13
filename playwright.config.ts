// Muat .env sebelum apa pun: global.setup & helper DB butuh DATABASE_URL,
// dan webServer mewarisi env proses ini (pola yang sama dengan tests/setup.ts).
import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Konfigurasi E2E browser (Playwright) — lapisan ketiga di atas Vitest
 * (unit/integration) dan tests/http/smoke.sh (HTTP envelope).
 *
 * `workers: 1` + `fullyParallel: false` DISENGAJA: seluruh spec berbagi SATU
 * database PostgreSQL dan spec admin memutasi state global (publish event,
 * ubah role) yang dibaca spec participant — keputusan yang sama dengan
 * `fileParallelism: false` di vitest.config.mts. Paralelisasi nanti lewat
 * namespacing data per-worker, bukan dengan menaikkan angka ini begitu saja.
 *
 * webServer memakai build produksi (`next build && next start`), bukan
 * `next dev`: kompilasi on-demand dev membuat navigasi pertama flaky, dan CSP
 * dev (`unsafe-eval`) berbeda dari yang benar-benar rilis. Saat iterasi lokal,
 * `reuseExistingServer: true` tetap mengizinkan menjalankan spec melawan
 * `npm run dev` yang sudah hidup di port 3000.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Setup sebagai project (bukan globalSetup) agar login-nya ikut ter-trace
    // di report dan siap untuk sharding CI kelak.
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    // Bukan `/` — middleware me-redirect root ke /login; health selalu 200.
    url: `${BASE_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // `.env` menyetel NODE_ENV=development dan dotenv di atas memuatnya ke
    // proses ini; `next build` dengan NODE_ENV≠production gagal prerender
    // (error `<Html> should not be imported…` di /404). Timpa khusus untuk
    // proses build+start — test tetap berjalan dengan env dari `.env`.
    env: { NODE_ENV: 'production' },
  },
});
