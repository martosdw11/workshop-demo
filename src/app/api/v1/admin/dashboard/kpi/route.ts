import { dashboardPeriodSchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseQuery } from '@/server/http/validate';
import { getDashboardKpi } from '@/server/services/stats.service';

/**
 * `GET /api/v1/admin/dashboard/kpi` — §3.4.
 * `?period=7d|30d|quarter|ytd` → `200 {totalEvents, activeToday, upcomingWeek, totalParticipants}`
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { period } = parseQuery(req, dashboardPeriodSchema);
  return ok(await getDashboardKpi(period));
});
