import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { reorderMaterialsSchema } from '@/lib/validation/material';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { reorderMaterials } from '@/server/services/material.service';

/**
 * `PATCH /api/v1/admin/events/:id/materials/reorder` — §3.4.
 * Satu request berisi SELURUH tree; server yang menghitung ulang `order_index`
 * dan `sequence_index` dalam satu transaksi (§6.7).
 * `422 MAX_DEPTH_EXCEEDED` · `409 STALE_TREE`.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, reorderMaterialsSchema);
  const { tree } = await reorderMaterials(eventId, input);

  return ok({ tree });
});
