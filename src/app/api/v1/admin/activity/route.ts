import { activityQuerySchema } from '@/lib/validation/response';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseQuery } from '@/server/http/validate';
import { getRecentActivity } from '@/server/services/stats.service';

/**
 * `GET /api/v1/admin/activity` — §3.4, query §7.2 (c).
 * `?eventId=&cursor=&limit=20` → `200 {items:[ActivityItem], nextCursor}`
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const query = parseQuery(req, activityQuerySchema);
  const { items, nextCursor } = await getRecentActivity(query);

  return ok({ items }, { nextCursor });
});
