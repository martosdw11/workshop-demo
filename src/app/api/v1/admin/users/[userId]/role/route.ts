import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { roleSchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { updateUserRole } from '@/server/services/user.service';

/**
 * `PATCH /api/v1/admin/users/:id/role` — §3.4, §5.3.
 * `403 CANNOT_DEMOTE_SELF` · `409 LAST_ADMIN`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ userId: idParam });
type Params = { userId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { userId } = parseParams(ctx.params, paramsSchema);
  const { role } = await parseBody(req, roleSchema);

  return ok({ user: await updateUserRole(userId, role, admin) });
});
