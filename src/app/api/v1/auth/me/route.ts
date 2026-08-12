import { requireUser } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { toMePayload } from '@/server/services/auth.service';

/**
 * `GET /api/v1/auth/me` — TDD §3.2.
 * Auth: P/A. `200 {id,name,email,role,totalPoints}` · `401 UNAUTHENTICATED`.
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (_req, ctx) => {
  const user = await requireUser();
  ctx.setUserId(user.id);
  return ok(toMePayload(user));
});
