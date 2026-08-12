import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getMaterialForParticipant } from '@/server/services/learning.service';

/**
 * `GET /api/v1/materials/:materialId` — §3.3.
 * `200 {material, isLocked, isReadOnly, pointsEarned, prevId, nextId, isLast}` ·
 * `403 MATERIAL_LOCKED` · `404`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ materialId: idParam });
type Params = { materialId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  const { materialId } = parseParams(ctx.params, paramsSchema);
  return ok(await getMaterialForParticipant(materialId, user));
});
