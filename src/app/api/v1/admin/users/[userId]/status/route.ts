import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { userStatusSchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { updateUserStatus } from '@/server/services/user.service';

/**
 * `PATCH /api/v1/admin/users/:id/status` — §3.4, §5.3.
 * Menonaktifkan akun mencabut SELURUH sesinya pada transaksi yang sama.
 * `403 CANNOT_DEACTIVATE_SELF`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ userId: idParam });
type Params = { userId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { userId } = parseParams(ctx.params, paramsSchema);
  const { status } = await parseBody(req, userStatusSchema);

  return ok({ user: await updateUserStatus(userId, status, admin) });
});
