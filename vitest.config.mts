import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Konfigurasi test — TDD §11.4.
 *
 * Berekstensi `.mts` (ESM) karena `package.json` proyek ini tidak menyetel
 * `"type": "module"`; tanpa itu Vitest memuat config sebagai CommonJS dan gagal
 * meng-`require` dependensinya yang ESM-only.
 *
 * `fileParallelism: false` DISENGAJA: seluruh test integrasi berbagi SATU
 * database PostgreSQL. Menjalankan file test secara paralel akan membuat fixture
 * saling menimpa, dan kegagalannya akan terlihat seperti bug konkurensi padahal
 * berasal dari test harness — persis kelas bug yang justru ingin dibuktikan
 * TIDAK ada oleh test ini.
 */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
