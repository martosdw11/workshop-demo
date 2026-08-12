import { registerSchema } from '@/lib/validation/auth';
import { setSessionCookie } from '@/server/auth/session';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { clientIp, created, withHandler } from '@/server/http/handler';
import { parseBody } from '@/server/http/validate';
import { register } from '@/server/services/auth.service';

/**
 * `POST /api/v1/auth/register` — TDD §3.2.
 * Publik. `201 {user, session}` · `422 VALIDATION_ERROR` · `409 EMAIL_TAKEN` · `429`.
 *
 * Route Handler tipis (§1.3): rate limit → validasi → service → serialisasi.
 */
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  // 3 / jam per IP — anti pendaftaran massal (§9.3).
  await enforceRateLimit(RATE_LIMITS.register, clientIp(req));

  const input = await parseBody(req, registerSchema);
  const { user, session } = await register(input, { userAgent: req.headers.get('user-agent') });

  // Token TIDAK PERNAH masuk body (§3.1) — hanya cookie HttpOnly.
  await setSessionCookie(session.token, session.ttlSeconds);

  return created({
    user,
    session: { expiresAt: session.expiresAt.toISOString() },
  });
});
