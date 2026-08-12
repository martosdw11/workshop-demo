import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { updateMaterialSchema } from '@/lib/validation/material';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { noContent, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { deleteMaterial, updateMaterial } from '@/server/services/material.service';

/**
 * `PATCH`  `/api/v1/admin/materials/:id` → `200 {material, summary}` (§3.4)
 * `DELETE` `/api/v1/admin/materials/:id` → `204`, `409 MATERIAL_HAS_PROGRESS`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ materialId: idParam });
type Params = { materialId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { materialId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, updateMaterialSchema);
  const { material, summary } = await updateMaterial(materialId, input);

  return ok({ material, summary });
});

export const DELETE = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { materialId } = parseParams(ctx.params, paramsSchema);
  await deleteMaterial(materialId);

  return noContent();
});
