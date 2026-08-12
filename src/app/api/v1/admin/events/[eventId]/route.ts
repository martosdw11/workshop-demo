import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { updateEventSchema } from '@/lib/validation/event';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { noContent, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import {
  deleteEvent,
  getAdminEventDetail,
  updateEvent,
} from '@/server/services/event.service';

/**
 * `GET`    `/api/v1/admin/events/:id` → `{event, materials:[MaterialTree]}` (§3.4)
 * `PATCH`  `/api/v1/admin/events/:id` → `403 EVENT_PUBLISHED_IMMUTABLE_FIELD`, `422`
 * `DELETE` `/api/v1/admin/events/:id` → `204`, `409 EVENT_HAS_ENROLLMENTS`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  return ok(await getAdminEventDetail(eventId));
});

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, updateEventSchema);

  return ok({ event: await updateEvent(eventId, input) });
});

export const DELETE = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  await deleteEvent(eventId);

  return noContent();
});
