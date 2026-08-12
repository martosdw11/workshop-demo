import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getCatalogEvent } from '@/server/services/catalog.service';

/**
 * `GET /api/v1/events/:eventId` — §3.3.
 * `200 {event, myEnrollment|null}` · `401` · `404 EVENT_NOT_FOUND`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  return ok(await getCatalogEvent(user.id, eventId));
});
