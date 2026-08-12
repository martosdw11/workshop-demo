import { pipelineQuerySchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseQuery } from '@/server/http/validate';
import { getPipelineSummary } from '@/server/services/stats.service';

/**
 * `GET /api/v1/admin/dashboard/pipeline` — §3.4.
 * `?period=&eventId=` → `200 {items:[{eventId,title,total,completed,inProgress,stalled}]}`
 * Klasifikasi Completed / In Progress / Stalled memakai `STALLED_THRESHOLD_DAYS` (§7.5).
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const query = parseQuery(req, pipelineQuerySchema);
  return ok({ items: await getPipelineSummary(query) });
});
