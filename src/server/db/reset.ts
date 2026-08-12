import 'dotenv/config';

import { sql } from 'drizzle-orm';

import { env } from '../env';
import { closeDb, db } from './client';

/**
 * Mengosongkan seluruh tabel data untuk memulai ulang development.
 * Struktur (tabel, index, trigger) TIDAK disentuh — hanya isinya.
 *
 * `TRUNCATE ... RESTART IDENTITY CASCADE` mengembalikan sequence id ke 1 sehingga
 * hasil seed berikutnya konsisten. Dilarang di production.
 */

if (env.NODE_ENV === 'production') {
  console.error('✖ db:reset dilarang dijalankan di production.');
  process.exit(1);
}

async function main() {
  console.log('▶ Mengosongkan seluruh tabel data…');

  await db.execute(sql`
    TRUNCATE TABLE
      responses,
      material_progress,
      enrollments,
      materials,
      events,
      sessions,
      rate_limits,
      users
    RESTART IDENTITY CASCADE
  `);

  console.log('✔ Selesai. Jalankan `npm run db:seed` untuk mengisi ulang data dasar.');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('✖ Reset gagal:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
