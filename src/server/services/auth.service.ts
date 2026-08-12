import { eq } from 'drizzle-orm';

import type { LoginInput, RegisterInput } from '@/lib/validation/auth';

import { hashPassword, verifyPassword } from '../auth/password';
import {
  cleanupExpiredSessionsOccasionally,
  createSession,
  revokeSessionByToken,
  type SessionUser,
} from '../auth/session';
import { db } from '../db/client';
import { users } from '../db/schema';
import { AppError } from '../http/errors';

/**
 * Business logic autentikasi — TDD §5, EPIC 2 story 2.2.
 *
 * Lapisan ini adalah SATU-SATUNYA yang menulis ke database (TDD §1.3);
 * Route Handler di atasnya hanya memvalidasi, memanggil, dan menserialisasi.
 */

/** Bentuk user yang aman dikirim ke klien — `password_hash` tidak pernah ikut. */
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'participant' | 'admin';
  status: 'active' | 'inactive';
  totalPoints: number;
  createdAt: string;
};

type UserRow = typeof users.$inferSelect;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    totalPoints: row.totalPoints,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Bentuk `GET /auth/me` persis seperti kontrak §3.2. */
export function toMePayload(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    totalPoints: user.totalPoints,
  };
}

/**
 * Hash "umpan" untuk login dengan email yang tidak terdaftar. Tanpa ini, durasi
 * respons membocorkan email mana yang punya akun: jalur "user tidak ada" akan
 * jauh lebih cepat daripada jalur verifikasi Argon2id.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('dummy-password-untuk-menyamakan-waktu-respons');
  return dummyHashPromise;
}

const PG_UNIQUE_VIOLATION = '23505';

type PgError = { code?: string; constraint_name?: string; constraint?: string; cause?: unknown };

/**
 * Drizzle membungkus error driver di `DrizzleQueryError`, sehingga kode SQLSTATE
 * berada di rantai `cause` — bukan di objek terluar. Penelusuran rantai ini yang
 * membuat `409 EMAIL_TAKEN` benar-benar berasal dari `UNIQUE (email)` database
 * (§9.2), bukan dari `SELECT` pendahuluan yang bisa kalah balapan.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const err = current as PgError;
    if (err.code === PG_UNIQUE_VIOLATION) {
      const name = err.constraint_name ?? err.constraint;
      return name === undefined || name === constraint;
    }
    current = err.cause;
  }
  return false;
}

export type AuthResult = {
  user: PublicUser;
  session: { token: string; expiresAt: Date; ttlSeconds: number };
};

/**
 * Registrasi mandiri — SELALU `role='participant'` (§5.3).
 * `RegisterInput` sengaja tidak punya field `role`, sehingga nilai `role` yang
 * dikirim klien tidak punya jalan masuk sama sekali (guard privilege escalation).
 *
 * Duplikat email dideteksi dari `UNIQUE (email)` di database, bukan dari
 * `SELECT` pendahuluan — dua registrasi bersamaan dengan email sama akan tetap
 * menghasilkan tepat satu akun.
 */
export async function register(
  input: RegisterInput,
  meta: { userAgent?: string | null },
): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let created: UserRow;
  try {
    const [row] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'participant',
        status: 'active',
      })
      .returning();
    created = row;
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_key')) {
      throw new AppError('EMAIL_TAKEN', { fields: { email: 'Email ini sudah terdaftar.' } });
    }
    throw error;
  }

  const session = await createSession({
    userId: created.id,
    rememberMe: false,
    userAgent: meta.userAgent,
  });

  return { user: toPublicUser(created), session };
}

export type LoginOutcome =
  | { ok: true; result: AuthResult }
  | { ok: false; reason: 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' };

/**
 * Login. Mengembalikan hasil, BUKAN melempar, untuk kasus kredensial salah —
 * pemanggil (route handler) perlu mencatat percobaan gagal ke rate limit
 * sebelum menerjemahkannya menjadi `401` (§9.3: batas dihitung dari kegagalan).
 */
export async function login(
  input: LoginInput,
  meta: { userAgent?: string | null },
): Promise<LoginOutcome> {
  const [found] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  if (!found) {
    // Tetap jalankan verifikasi agar durasi respons tidak membocorkan keberadaan akun.
    await verifyPassword(await getDummyHash(), input.password).catch(() => false);
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  const valid = await verifyPassword(found.passwordHash, input.password).catch(() => false);
  if (!valid) return { ok: false, reason: 'INVALID_CREDENTIALS' };

  // Urutan disengaja: password diverifikasi lebih dulu, supaya status akun tidak
  // bisa dipakai menebak email yang terdaftar.
  if (found.status !== 'active') return { ok: false, reason: 'ACCOUNT_INACTIVE' };

  const session = await createSession({
    userId: found.id,
    rememberMe: input.rememberMe,
    userAgent: meta.userAgent,
  });

  // Pembersihan sesi kedaluwarsa menumpang di sini (±1%) — tanpa cron/worker (§2.8).
  await cleanupExpiredSessionsOccasionally();

  return { ok: true, result: { user: toPublicUser(found), session } };
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await revokeSessionByToken(token);
}
