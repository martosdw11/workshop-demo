import { clearSessionCookie, readSessionToken } from '@/server/auth/session';
import { noContent, withHandler } from '@/server/http/handler';
import { logout } from '@/server/services/auth.service';

/**
 * `POST /api/v1/auth/logout` — TDD §3.2. Auth: P/A. Respons `204`.
 *
 * Sengaja TIDAK memanggil `requireUser()`: logout atas sesi yang sudah tidak
 * valid tetap harus berhasil (dan tetap menghapus cookie), bukan menjawab `401`
 * yang membuat pengguna terjebak dengan cookie basi di browser.
 */
export const dynamic = 'force-dynamic';

export const POST = withHandler(async () => {
  await logout(await readSessionToken());
  await clearSessionCookie();
  return noContent();
});
