import { createHash, randomBytes } from 'node:crypto';

import { eq, lt, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { db, type DbExecutor } from '../db/client';
import { sessions } from '../db/schema';
import { env } from '../env';
import type { UserRole, UserStatus } from '../db/schema/enums';

/**
 * Session store — TDD §5.1, tabel `sessions` (§2.8).
 *
 * Cookie berisi OPAQUE TOKEN 256-bit, bukan JWT. Alasannya satu: revoke instan.
 * Menonaktifkan akun lewat User Access harus mematikan tab yang sedang terbuka
 * saat itu juga (§5.3) — JWT baru bisa dicabut setelah kedaluwarsa.
 *
 * Yang disimpan di database adalah SHA-256 dari token, bukan tokennya: dump
 * database tidak langsung berarti sesi bisa dibajak.
 */

const TOKEN_BYTES = 32; // 256-bit
const SLIDING_THRESHOLD = 0.5; // perpanjang bila sisa umur < 50% (§5.1)
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000; // tulis `last_used_at` maks. 1×/5 menit (§2.8)
const CLEANUP_PROBABILITY = 0.01; // pembersihan oportunistik ±1% saat login (§2.8)

export const SESSION_COOKIE = env.SESSION_COOKIE_NAME;

/**
 * ASUMSI EKSPLISIT (A-B04): atribut `Secure` diikat ke skema `APP_BASE_URL`,
 * bukan di-hardcode `true`. Di produksi `APP_BASE_URL` selalu `https://` sehingga
 * cookie tetap `Secure` sesuai §5.1; di development (`http://localhost`) mematikan
 * `Secure` adalah satu-satunya cara menguji alur auth lewat curl/REST client,
 * karena klien HTTP menolak mengirim cookie `Secure` melalui koneksi non-TLS.
 */
const USE_SECURE_COOKIE = env.APP_BASE_URL.startsWith('https://');

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  totalPoints: number;
  sessionId: number;
};

export type CreatedSession = { token: string; expiresAt: Date; ttlSeconds: number };

/** Membuat sesi baru. Token dikembalikan SEKALI — setelahnya hanya hash-nya yang ada. */
export async function createSession(params: {
  userId: number;
  rememberMe: boolean;
  userAgent?: string | null;
  tx?: DbExecutor;
}): Promise<CreatedSession> {
  const ttlSeconds = params.rememberMe
    ? env.SESSION_REMEMBER_TTL_SECONDS
    : env.SESSION_TTL_SECONDS;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const conn = params.tx ?? db;

  await conn.insert(sessions).values({
    tokenHash: hashToken(token),
    userId: params.userId,
    expiresAt,
    ttlSeconds,
    userAgent: params.userAgent?.slice(0, 255) ?? null,
  });

  return { token, expiresAt, ttlSeconds };
}

type SessionRow = {
  session_id: number;
  expires_at: Date;
  last_used_at: Date;
  ttl_seconds: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  total_points: number;
};

/**
 * Validasi sesi — SATU query join `sessions` × `users` yang sekaligus mengambil
 * `role` dan `status` (§5.1). Ini query terpanas di aplikasi; ia berjalan lewat
 * index #16 (`UNIQUE (token_hash)`).
 *
 * Efek samping yang disengaja:
 * - sesi kedaluwarsa langsung dihapus,
 * - akun non-aktif memicu revoke SELURUH sesinya (§5.2 "Hapus sesi"),
 * - sliding refresh + `last_used_at` ditulis paling sering sekali per 5 menit.
 */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const rows = (await db.execute<SessionRow>(sql`
    SELECT s.id           AS session_id,
           s.expires_at,
           s.last_used_at,
           s.ttl_seconds,
           u.id           AS user_id,
           u.name,
           u.email,
           u.phone,
           u.role,
           u.status,
           u.total_points
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ${hashToken(token)}
  `)) as unknown as SessionRow[];

  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();

  if (expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.id, row.session_id));
    return null;
  }

  if (row.status !== 'active') {
    // Akun nonaktif tidak boleh masih punya tab terbuka yang berfungsi (§5.3).
    await revokeAllSessionsForUser(row.user_id);
    return null;
  }

  await touchSession(row, now);

  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    totalPoints: row.total_points,
    sessionId: row.session_id,
  };
}

/** Sliding refresh + pembaruan `last_used_at`, digabung jadi satu UPDATE. */
async function touchSession(row: SessionRow, now: number): Promise<void> {
  const expiresAt = new Date(row.expires_at).getTime();
  const remaining = expiresAt - now;
  const shouldSlide = remaining < row.ttl_seconds * 1000 * SLIDING_THRESHOLD;
  const shouldTouch = now - new Date(row.last_used_at).getTime() > LAST_USED_THROTTLE_MS;

  if (!shouldSlide && !shouldTouch) return;

  const nextExpiresAt = shouldSlide ? new Date(now + row.ttl_seconds * 1000) : undefined;

  await db
    .update(sessions)
    .set({
      lastUsedAt: new Date(now),
      ...(nextExpiresAt ? { expiresAt: nextExpiresAt } : {}),
    })
    .where(eq(sessions.id, row.session_id));

  // Cookie ikut diperpanjang bila konteksnya mengizinkan menulis cookie
  // (Route Handler / Server Action). Di Server Component store-nya read-only —
  // di sana cukup `expires_at` di database yang bergeser.
  if (nextExpiresAt) {
    try {
      const store = await cookies();
      const current = store.get(SESSION_COOKIE)?.value;
      if (current) setSessionCookieOn(store, current, row.ttl_seconds);
    } catch {
      /* konteks read-only — diabaikan dengan sengaja */
    }
  }
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/**
 * Revoke massal — dipakai saat akun dinonaktifkan atau password direset (§5.1).
 * Menerima `tx` supaya bisa dijalankan di TRANSAKSI YANG SAMA dengan perubahan
 * status akun (§5.3), bukan sebagai langkah terpisah yang bisa gagal sendirian.
 */
export async function revokeAllSessionsForUser(userId: number, tx?: DbExecutor): Promise<void> {
  await (tx ?? db).delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Pembersihan sesi kedaluwarsa, dijalankan OPORTUNISTIK (±1% saat login).
 * Tidak butuh cron maupun worker (§2.8). Kegagalannya tidak boleh menggagalkan
 * login — karena itu error-nya ditelan.
 */
export async function cleanupExpiredSessionsOccasionally(): Promise<void> {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  } catch {
    /* pembersihan bersifat best-effort */
  }
}

/** Menghitung berapa sesi aktif milik user — dipakai test & diagnostik. */
export async function countActiveSessions(userId: number): Promise<number> {
  const rows = (await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM sessions
     WHERE user_id = ${userId} AND expires_at > now()
  `)) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function setSessionCookieOn(store: CookieStore, token: string, ttlSeconds: number): void {
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: USE_SECURE_COOKIE,
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds,
  });
}

/** Dipakai `POST /auth/register` dan `POST /auth/login`. */
export async function setSessionCookie(token: string, ttlSeconds: number): Promise<void> {
  setSessionCookieOn(await cookies(), token, ttlSeconds);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: USE_SECURE_COOKIE,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
