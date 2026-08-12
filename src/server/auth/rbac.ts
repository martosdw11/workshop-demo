import { AppError } from '../http/errors';
import type { UserRole } from '../db/schema/enums';
import { readSessionToken, validateSessionToken, type SessionUser } from './session';

/**
 * Otorisasi — TDD §5.2 & §5.3.
 *
 * INILAH pengaman sesungguhnya, bukan `middleware.ts`. `requireUser()` /
 * `requireRole()` WAJIB dipanggil di setiap Route Handler non-publik dan di
 * `layout.tsx` tiap route group (epic FE).
 *
 * Middleware hanya memeriksa keberadaan cookie tanpa menyentuh database; ia
 * mempercepat redirect, tidak menjamin apa pun.
 */

export type { SessionUser };

/** `null` bila tidak ada cookie, sesi kedaluwarsa, atau akun sudah dinonaktifkan. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError('UNAUTHENTICATED');
  return user;
}

/**
 * Peserta mengakses `/admin/**` → `403 FORBIDDEN` (§5.3), bukan 404 dan bukan
 * redirect: klien API perlu bisa membedakan "belum login" dari "salah peran".
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) throw new AppError('FORBIDDEN');
  return user;
}

export const requireAdmin = () => requireRole('admin');
export const requireParticipant = () => requireRole('participant');
