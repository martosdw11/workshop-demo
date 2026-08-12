import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { resetUserPassword } from '@/server/services/user.service';

/**
 * `POST /api/v1/admin/users/:id/reset-password` — §3.4, asumsi A-09.
 * `200 {temporaryPassword}` — ditampilkan SEKALI di UI, tanpa email.
 * Nilainya tidak pernah masuk log (`http/logger.ts` me-redact `temporaryPassword`).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ userId: idParam });
type Params = { userId: string };

export const POST = withHandler<Params>(async (_req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { userId } = parseParams(ctx.params, paramsSchema);
  return ok(await resetUserPassword(userId));
});
