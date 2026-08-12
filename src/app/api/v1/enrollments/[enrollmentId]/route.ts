import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getEnrollmentDetail } from '@/server/services/learning.service';

/**
 * `GET /api/v1/enrollments/:id` — §3.3.
 * `200 {enrollment, path:[PathNode], progressPercent}` · `403 FORBIDDEN` · `404`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ enrollmentId: idParam });
type Params = { enrollmentId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  const { enrollmentId } = parseParams(ctx.params, paramsSchema);
  return ok(await getEnrollmentDetail(enrollmentId, user));
});
