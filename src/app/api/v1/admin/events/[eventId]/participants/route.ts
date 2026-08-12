import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { eventParticipantQuerySchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams, parseQuery } from '@/server/http/validate';
import { getEventParticipants } from '@/server/services/event-detail.service';

/**
 * `GET /api/v1/admin/events/:id/participants` — §3.4.
 * Matriks peserta × materi, cursor 25 peserta per halaman.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const query = parseQuery(req, eventParticipantQuerySchema);
  const { items, materials, nextCursor } = await getEventParticipants(eventId, query);

  return ok({ items, materials }, { nextCursor });
});
