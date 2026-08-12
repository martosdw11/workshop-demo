import { requireParticipant } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { getParticipantDashboard } from '@/server/services/learning.service';

/**
 * `GET /api/v1/me/dashboard` — §3.3.
 * `200 {kpi, continueLearning, achievements[]}` · `401`
 *
 * Personal sepenuhnya → TIDAK di-cache lintas user (§1.2).
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);
  return ok(await getParticipantDashboard(user));
});
