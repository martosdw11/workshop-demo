import { loginSchema } from '@/lib/validation/auth';
import { setSessionCookie } from '@/server/auth/session';
import {
  RATE_LIMITS,
  assertRateLimitNotExceeded,
  recordRateLimitHit,
  resetRateLimit,
} from '@/server/cache/ratelimit';
import { AppError } from '@/server/http/errors';
import { clientIp, ok, withHandler } from '@/server/http/handler';
import { parseBody } from '@/server/http/validate';
import { login } from '@/server/services/auth.service';

/**
 * `POST /api/v1/auth/login` — TDD §3.2.
 * Publik. `200 {user}` + Set-Cookie · `401 INVALID_CREDENTIALS` ·
 * `403 ACCOUNT_INACTIVE` · `429 RATE_LIMITED`.
 *
 * Rate limit `login` dihitung dari percobaan GAGAL saja (§9.3): batas diperiksa
 * SEBELUM hashing (melindungi CPU dari Argon2id, §5.1) dan hitungannya bertambah
 * hanya bila kredensial salah, lalu di-reset saat login berhasil.
 */
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const input = await parseBody(req, loginSchema);
  const identifier = `${input.email}|${clientIp(req)}`;

  await assertRateLimitNotExceeded(RATE_LIMITS.login, identifier);

  const outcome = await login(input, { userAgent: req.headers.get('user-agent') });

  if (!outcome.ok) {
    await recordRateLimitHit(RATE_LIMITS.login, identifier);
    throw new AppError(outcome.reason);
  }

  await resetRateLimit(RATE_LIMITS.login, identifier);
  await setSessionCookie(outcome.result.session.token, outcome.result.session.ttlSeconds);

  return ok({ user: outcome.result.user });
});
