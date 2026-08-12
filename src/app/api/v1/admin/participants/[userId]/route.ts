import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { getParticipantDetail } from '@/server/services/user.service';

/**
 * `GET /api/v1/admin/participants/:userId` — §3.4.
 * `200 {profile, enrollments:[{event,status,points,progress}]}` · `404 USER_NOT_FOUND`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ userId: idParam });
type Params = { userId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const { userId } = parseParams(ctx.params, paramsSchema);
  return ok(await getParticipantDetail(userId));
});
