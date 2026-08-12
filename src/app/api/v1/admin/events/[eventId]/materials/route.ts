import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { createMaterialSchema } from '@/lib/validation/material';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { created, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { createMaterial, getEventTree } from '@/server/services/material.service';

/**
 * `GET  /api/v1/admin/events/:id/materials` → `{tree, materialCount, totalPoints}` (§3.4)
 * `POST /api/v1/admin/events/:id/materials` → `201 {material, summary}`
 *        `422 MAX_DEPTH_EXCEEDED` · `422 POINTS_NEGATIVE`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const { tree, materialCount, totalPoints } = await getEventTree(eventId);

  return ok({ tree, materialCount, totalPoints });
});

export const POST = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, createMaterialSchema);
  const { material, summary } = await createMaterial(eventId, input);

  return created({ material, summary });
});
