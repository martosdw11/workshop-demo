import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { completeMaterial } from '@/server/services/scoring.service';

/**
 * `POST /api/v1/materials/:materialId/complete` — §3.3, payload §3.5 (3). ⛔ kritikal.
 * Transaksi scoring §4.3, all-or-nothing, idempoten (§4.4).
 * `403 ENROLLMENT_COMPLETED` · `403 MATERIAL_LOCKED` · `404`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ materialId: idParam });
type Params = { materialId: string };

export const POST = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { materialId } = parseParams(ctx.params, paramsSchema);
  return ok(await completeMaterial(materialId, user));
});
