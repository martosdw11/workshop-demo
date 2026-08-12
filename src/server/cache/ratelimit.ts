import { sql } from 'drizzle-orm';

import { db } from '../db/client';
import { env } from '../env';
import { AppError } from '../http/errors';

/**
 * Rate limiting — TDD §9.3, tabel `rate_limits` (§2.9).
 *
 * FIXED WINDOW, bukan sliding: satu `INSERT ... ON CONFLICT DO UPDATE` yang
 * me-reset `count` bila `window_start` sudah lewat. Presisinya memang lebih
 * longgar (peserta bisa mengirim 2× batas tepat di perbatasan jendela) dan itu
 * diterima secara sadar — fungsinya meredam spam & double-submit, bukan
 * menegakkan kuota berbayar. Menukarnya dengan Redis tidak sepadan di skala ini.
 *
 * Awal jendela dihitung dari `now()` DATABASE, bukan jam proses aplikasi, supaya
 * tetap benar bila kelak ada lebih dari satu instance (§7.4).
 */

export type RateLimitRule = {
  /** `varchar(40)` di tabel — jangan melebihi 40 karakter. */
  scope: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  /** 5 kegagalan / 15 menit, identifier `email` + IP (§9.3). */
  login: { scope: 'login', limit: 5, windowSeconds: 15 * 60 },
  /** 3 / jam per IP — anti pendaftaran massal (§9.3). */
  register: { scope: 'register', limit: 3, windowSeconds: 60 * 60 },
  /** 10 / menit per peserta (PRD §7.2), dapat dikalibrasi lewat env. */
  response: {
    scope: 'response',
    limit: env.RATE_LIMIT_RESPONSE_PER_MINUTE,
    windowSeconds: 60,
  },
  /** 20 / menit — peredam double-click, bukan pengaman utama (§4.4). */
  enroll: { scope: 'enroll', limit: 20, windowSeconds: 60 },
  /** Jaring pengaman terakhir untuk SELURUH endpoint tulis (§9.3). */
  writeGlobal: { scope: 'write_global', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/** Kolom `identifier` adalah `varchar(160)` — nilai panjang dipotong, bukan gagal insert. */
function normalizeIdentifier(identifier: string): string {
  return identifier.length <= 160 ? identifier : identifier.slice(0, 160);
}

function retryAfterSeconds(windowStart: Date, windowSeconds: number): number {
  const endsAt = windowStart.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
}

function rateLimited(rule: RateLimitRule, windowStart: Date): never {
  const retryAfter = retryAfterSeconds(windowStart, rule.windowSeconds);
  const details = {
    limit: rule.limit,
    windowSeconds: rule.windowSeconds,
    retryAfterSeconds: retryAfter,
  };
  // Pesan §3.5 untuk submit respons memakai bentuk berhitung; scope lain memakai
  // pesan generik §9.4. Kode `RATE_LIMITED` sama di semua kasus (kontrak mesin).
  const message =
    rule.scope === RATE_LIMITS.response.scope
      ? `Terlalu banyak pengiriman. Coba lagi dalam ${retryAfter} detik.`
      : undefined;
  throw new AppError('RATE_LIMITED', details, message);
}

type CounterRow = { count: number; window_start: Date };

/**
 * Satu upsert: menambah hitungan dan mengembalikan nilai terbaru.
 * Melebihi batas → `429 RATE_LIMITED` + `Retry-After` (diisi `withHandler`).
 */
export async function enforceRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const id = normalizeIdentifier(identifier);
  const rows = (await db.execute<CounterRow>(sql`
    INSERT INTO rate_limits (scope, identifier, window_start, count)
    VALUES (
      ${rule.scope},
      ${id},
      to_timestamp(floor(extract(epoch FROM now()) / ${rule.windowSeconds}) * ${rule.windowSeconds}),
      1
    )
    ON CONFLICT (scope, identifier) DO UPDATE
       SET count = CASE
                     WHEN rate_limits.window_start < excluded.window_start THEN 1
                     ELSE rate_limits.count + 1
                   END,
           window_start = GREATEST(rate_limits.window_start, excluded.window_start)
    RETURNING count, window_start
  `)) as unknown as CounterRow[];

  const row = rows[0];
  if (row && row.count > rule.limit) rateLimited(rule, new Date(row.window_start));
}

/**
 * Pemeriksaan tanpa menambah hitungan. Dipakai `login`, yang batasnya dihitung
 * dari percobaan GAGAL saja (§9.3) — login berhasil tidak boleh ikut mengunci.
 */
export async function assertRateLimitNotExceeded(
  rule: RateLimitRule,
  identifier: string,
): Promise<void> {
  const id = normalizeIdentifier(identifier);
  const rows = (await db.execute<CounterRow>(sql`
    SELECT count, window_start
      FROM rate_limits
     WHERE scope = ${rule.scope}
       AND identifier = ${id}
       AND window_start >= to_timestamp(
             floor(extract(epoch FROM now()) / ${rule.windowSeconds}) * ${rule.windowSeconds})
  `)) as unknown as CounterRow[];

  const row = rows[0];
  if (row && row.count >= rule.limit) rateLimited(rule, new Date(row.window_start));
}

/** Mencatat satu percobaan gagal tanpa melempar error. */
export async function recordRateLimitHit(
  rule: RateLimitRule,
  identifier: string,
): Promise<void> {
  const id = normalizeIdentifier(identifier);
  await db.execute(sql`
    INSERT INTO rate_limits (scope, identifier, window_start, count)
    VALUES (
      ${rule.scope},
      ${id},
      to_timestamp(floor(extract(epoch FROM now()) / ${rule.windowSeconds}) * ${rule.windowSeconds}),
      1
    )
    ON CONFLICT (scope, identifier) DO UPDATE
       SET count = CASE
                     WHEN rate_limits.window_start < excluded.window_start THEN 1
                     ELSE rate_limits.count + 1
                   END,
           window_start = GREATEST(rate_limits.window_start, excluded.window_start)
  `);
}

/** Membersihkan hitungan setelah login berhasil supaya pengguna sah tidak terkunci. */
export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM rate_limits
     WHERE scope = ${rule.scope} AND identifier = ${normalizeIdentifier(identifier)}
  `);
}
