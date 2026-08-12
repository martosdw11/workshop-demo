import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getParticipantEventDrilldown } from '@/server/services/user.service';

/**
 * `GET /api/v1/admin/participants/:userId/events/:eventId` — §3.4.
 * `200 {perMaterialPoints[], responses[]}` · `404`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ userId: idParam, eventId: idParam });
type Params = { userId: string; eventId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { userId, eventId } = parseParams(ctx.params, paramsSchema);
  return ok(await getParticipantEventDrilldown(userId, eventId));
});
