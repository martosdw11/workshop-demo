import fs from 'node:fs';
import path from 'node:path';

import { expect, test as setup, type APIRequestContext } from '@playwright/test';

import {
  ADMIN_STATE,
  PARTICIPANT_STATE,
  adminCredentials,
  participantCredentials,
} from './helpers/auth';
import { cleanupTestData, clearRateLimits } from './helpers/db';

/**
 * Project `setup` — berjalan SEKALI sebelum project `chromium`.
 *
 * 1. Menghapus jejak run sebelumnya (data `@test.local` / `[TEST]`) dan SELURUH
 *    rate limit, sehingga run bisa diulang tanpa jeda 1 jam.
 * 2. Login admin & peserta lewat API (bukan UI — UI login diuji auth.spec.ts)
 *    lalu menyimpan cookie session sebagai storageState untuk dipakai spec.
 */

setup('bersihkan jejak run sebelumnya', async () => {
  await clearRateLimits();
  await cleanupTestData();
});

async function loginAndSaveState(
  request: APIRequestContext,
  credentials: { email: string; password: string },
  statePath: string,
): Promise<void> {
  const response = await request.post('/api/v1/auth/login', { data: credentials });

  if (response.status() === 401 || response.status() === 403) {
    throw new Error(
      `Login ${credentials.email} ditolak (${response.status()}). ` +
        'Akun seed belum ada atau password beda — jalankan `npm run db:seed` ' +
        'dan pastikan SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD di .env sesuai.',
    );
  }
  expect(response.ok()).toBeTruthy();

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await request.storageState({ path: statePath });
}

setup('login admin → storageState', async ({ request }) => {
  await loginAndSaveState(request, adminCredentials, ADMIN_STATE);
});

setup('login peserta → storageState', async ({ request }) => {
  await loginAndSaveState(request, participantCredentials, PARTICIPANT_STATE);
});
