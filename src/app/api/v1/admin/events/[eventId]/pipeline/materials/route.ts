import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getMaterialDrilldown } from '@/server/services/stats.service';

/**
 * `GET /api/v1/admin/events/:id/pipeline/materials` — §3.4.
 * Drill-down "berapa peserta sedang berada di tiap materi" (§7.2 b).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  return ok(await getMaterialDrilldown(eventId));
});
