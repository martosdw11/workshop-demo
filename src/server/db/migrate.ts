import 'dotenv/config';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { closeDb, db } from './client';

/**
 * Runner migrasi — TDD §2.11.
 *
 * Dijalankan sebagai LANGKAH TERSENDIRI dalam pipeline deploy (`npm run db:migrate`),
 * bukan di `postinstall` maupun saat boot aplikasi: migrasi saat boot membuat
 * kegagalan skema muncul sebagai aplikasi crash-loop, bukan deploy yang gagal jelas.
 */
async function main() {
  const start = Date.now();
  console.log('▶ Menjalankan migrasi database…');

  await migrate(db, { migrationsFolder: './src/server/db/migrations' });

  console.log(`✔ Migrasi selesai dalam ${Date.now() - start} ms`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('✖ Migrasi gagal:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
