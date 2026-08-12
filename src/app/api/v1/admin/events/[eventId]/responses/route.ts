import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { adminResponseQuerySchema } from '@/lib/validation/response';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams, parseQuery } from '@/server/http/validate';
import { getEventResponses } from '@/server/services/event-detail.service';

/**
 * `GET /api/v1/admin/events/:id/responses` — §3.4.
 * Filter `?type=&materialId=&issueStatus=&cursor=&limit=25`.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const query = parseQuery(req, adminResponseQuerySchema);
  const { items, nextCursor } = await getEventResponses(eventId, query);

  return ok({ items }, { nextCursor });
});
