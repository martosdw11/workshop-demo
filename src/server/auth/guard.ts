import { AppError } from '../http/errors';
import type { SessionUser } from './session';

/**
 * Guard kepemilikan resource — TDD §5.2 baris "Service layer".
 *
 * Melindungi dari IDOR: peserta A tidak boleh membuka `enrollment` milik peserta
 * B walau tahu ID-nya. Ini lapis ketiga, terpisah dari autentikasi (`requireUser`)
 * dan peran (`requireRole`) — ketiganya harus lulus.
 *
 * Sengaja mengembalikan `403 FORBIDDEN`, BUKAN `404`: kontrak §3.3 memakai
 * `403 FORBIDDEN` untuk `GET /enrollments/:id` milik orang lain.
 */

export function assertOwnership(resourceUserId: number, user: SessionUser): void {
  if (resourceUserId !== user.id) throw new AppError('FORBIDDEN');
}

/**
 * Guard aksi admin terhadap akun sendiri (§5.3): admin tidak boleh menurunkan
 * peran atau menonaktifkan dirinya sendiri — jika boleh, seorang admin dapat
 * mengunci dirinya keluar dari satu-satunya jalur pemulihan yang ada.
 */
export function assertNotSelf(
  targetUserId: number,
  actor: SessionUser,
  code: 'CANNOT_DEMOTE_SELF' | 'CANNOT_DEACTIVATE_SELF',
): void {
  if (targetUserId === actor.id) throw new AppError(code);
}
