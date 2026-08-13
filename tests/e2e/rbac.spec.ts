import { expect, request as pwRequest, test } from '@playwright/test';

import { ADMIN_STATE, PARTICIPANT_STATE } from './helpers/auth';

/**
 * RBAC & guard akses — TDD §5.2, §5.3.
 *
 * Halaman: guard layout adalah redirect senyap (tidak ada halaman 403).
 * API: envelope JSON `403 FORBIDDEN` — middleware sengaja tidak menyentuh
 * `/api/**`; penegaknya `requireRole()` di route handler.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('peserta', () => {
  test.use({ storageState: PARTICIPANT_STATE });

  test('membuka /admin → dilempar balik ke /dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('/dashboard');
  });

  test('memanggil API admin → 403 FORBIDDEN (envelope JSON, bukan redirect)', async () => {
    const api = await pwRequest.newContext({
      baseURL: BASE_URL,
      storageState: PARTICIPANT_STATE,
    });
    const response = await api.get('/api/v1/admin/events');

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
    await api.dispose();
  });
});

test.describe('tanpa sesi', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('halaman terlindungi → redirect /login dengan parameter next', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login\?next=%2Fdashboard/);

    await page.goto('/admin/events');
    await page.waitForURL(/\/login\?next=%2Fadmin%2Fevents/);
  });

  test('API tanpa cookie → 401 UNAUTHENTICATED', async () => {
    const api = await pwRequest.newContext({ baseURL: BASE_URL });
    const response = await api.get('/api/v1/auth/me');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    await api.dispose();
  });
});

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('membuka halaman peserta → dialihkan ke /admin', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/admin');
  });
});
