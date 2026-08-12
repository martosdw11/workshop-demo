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

/**
 * Parser `int8`/`bigint` (OID 20) → `number`.
 *
 * Tanpa ini, postgres.js mengembalikan bigint sebagai STRING, sehingga query SQL
 * mentah (`db.execute`) menghasilkan `{"id":"5"}` sementara query Drizzle bertipe
 * menghasilkan `{"id":5}` — dua bentuk berbeda untuk kolom yang sama, dan kontrak
 * §3.5 memakai angka. Aman pada skala ini: proyeksi ± 500 ribu baris/tahun (A-06)
 * jauh di bawah `Number.MAX_SAFE_INTEGER`.
 */
const int8AsNumber = {
  to: 20,
  from: [20],
  serialize: (value: number | string | bigint) => value.toString(),
  parse: (value: string) => Number(value),
};

function createClient(): postgres.Sql {
  return postgres(env.DATABASE_URL, {
    types: { bigint: int8AsNumber },
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

/**
 * Handle transaksi Drizzle. Bentuknya BEDA dari `Database` (tidak punya
 * `$client`), sehingga fungsi yang harus bisa dipanggil di dalam maupun di luar
 * transaksi memakai `DbExecutor`, bukan `Database`. Ini yang menjaga transaksi
 * §4.2/§4.3 tetap satu unit all-or-nothing: helper-nya menerima `tx`, bukan
 * diam-diam memakai koneksi pool lain.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | Transaction;

export { schema };

/**
 * Menutup pool secara eksplisit. Dipakai script CLI (seed, migrate) supaya proses
 * Node berakhir; JANGAN dipanggil dari route handler atau komponen.
 */
export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
