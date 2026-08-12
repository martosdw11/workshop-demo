import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { finishEnrollment } from '@/server/services/learning.service';

/**
 * `POST /api/v1/enrollments/:id/finish` — §3.3, payload §3.5 (4).
 * `200 {enrollment, summary, readOnly, redirectTo}` ·
 * `403 NOT_AT_LAST_MATERIAL` · `403 FORBIDDEN`
 *
 * Idempoten (§4.4): pemanggilan ke-2 mengembalikan payload yang sama dan
 * `completedAt` tidak berubah.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ enrollmentId: idParam });
type Params = { enrollmentId: string };

export const POST = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { enrollmentId } = parseParams(ctx.params, paramsSchema);
  return ok(await finishEnrollment(enrollmentId, user));
});
