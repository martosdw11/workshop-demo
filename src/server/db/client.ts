import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../env';
import * as schema from './schema';

/**
 * Koneksi PostgreSQL — TDD §1.3 (`server/db/client.ts`) & §11.2.
 *
 * SINGLETON LINTAS HOT-RELOAD: di `next dev`, setiap perubahan file membuat modul
 * dievaluasi ulang. Tanpa cache di `globalThis`, tiap reload akan membuka pool baru
 * dan koneksi lama menggantung sampai database menolak koneksi berikutnya.
 * Di production modul hanya dievaluasi sekali, jadi cache tidak dipakai.
 */

const globalForDb = globalThis as unknown as {
  __lsaiSql?: postgres.Sql;
};

function createClient(): postgres.Sql {
  return postgres(env.DATABASE_URL, {
    // Kecil dan disengaja (§11.2). Turunkan ke 5 di platform serverless, dan di sana
    // WAJIB memakai connection string ber-pooler dari penyedia database.
    max: env.DATABASE_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    // Query lambat harus gagal cepat, bukan menahan koneksi.
    // idle_in_transaction: transaksi menggantung yang memegang `FOR UPDATE` pada
    // baris event akan memblokir semua peserta yang sedang join event tersebut.
    connection: {
      statement_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
    // Log query hanya saat development, dan tidak pernah memuat nilai parameter.
    onnotice: env.NODE_ENV === 'development' ? undefined : () => {},
  });
}

export const sql = globalForDb.__lsaiSql ?? createClient();

if (env.NODE_ENV !== 'production') {
  globalForDb.__lsaiSql = sql;
}

/** Instance Drizzle yang dipakai SELURUH service layer. */
export const db = drizzle(sql, { schema, logger: env.NODE_ENV === 'development' });

export type Database = typeof db;
export { schema };

/**
 * Menutup pool secara eksplisit. Dipakai script CLI (seed, migrate) supaya proses
 * Node berakhir; JANGAN dipanggil dari route handler atau komponen.
 */
export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
