import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { noContent, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { adminDeleteResponse } from '@/server/services/event-detail.service';

/**
 * `DELETE /api/v1/admin/responses/:id` — admin all-access (moderasi): hapus
 * respons apa pun, termasuk milik peserta lain. `204` · `404 NOT_FOUND`.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ responseId: idParam });
type Params = { responseId: string };

export const DELETE = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { responseId } = parseParams(ctx.params, paramsSchema);
  await adminDeleteResponse(responseId);

  return noContent();
});
