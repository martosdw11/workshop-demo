import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { publishEventSchema } from '@/lib/validation/event';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { setEventPublishStatus } from '@/server/services/event.service';

/**
 * `POST /api/v1/admin/events/:id/publish` — §3.4.
 * `422 EVENT_HAS_NO_MATERIAL`; kembali ke draft selalu diperbolehkan dan tidak
 * menyentuh enrollment yang sudah ada.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const POST = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const { status } = await parseBody(req, publishEventSchema);

  return ok({ event: await setEventPublishStatus(eventId, status) });
});
