import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Konfigurasi test — TDD §11.4.
 *
 * Berekstensi `.mts` (ESM) karena `package.json` proyek ini tidak menyetel
 * `"type": "module"`; tanpa itu Vitest memuat config sebagai CommonJS dan gagal
 * meng-`require` dependensinya yang ESM-only.
 *
 * Dua project agar keduanya bisa dijalankan terpisah (`--project unit` tidak
 * butuh PostgreSQL sama sekali — fast lane untuk CI kelak):
 *
 * - `unit`        : test murni, paralel, timeout default.
 * - `integration` : butuh PostgreSQL hidup. `fileParallelism: false` DISENGAJA:
 *   seluruh test integrasi berbagi SATU database. Menjalankan file test secara
 *   paralel akan membuat fixture saling menimpa, dan kegagalannya akan terlihat
 *   seperti bug konkurensi padahal berasal dari test harness — persis kelas bug
 *   yang justru ingin dibuktikan TIDAK ada oleh test ini.
 *
 * Spec Playwright hidup di `tests/e2e/**` dengan ekstensi `.spec.ts` dan TIDAK
 * pernah masuk ke sini — include kedua project di bawah hanya menunjuk
 * `tests/unit` dan `tests/integration`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: ['tests/setup.ts'],
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          setupFiles: ['tests/setup.ts'],
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
