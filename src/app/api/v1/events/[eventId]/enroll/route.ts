import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { requireParticipant } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { created, withHandler } from '@/server/http/handler';
import { parseParams } from '@/server/http/validate';
import { enroll } from '@/server/services/enrollment.service';

/**
 * `POST /api/v1/events/:eventId/enroll` — §3.3, transaksi §4.2. ⛔ kritikal.
 *
 * `201 {enrollment, firstMaterialId}` ·
 * `409 ALREADY_ENROLLED` (+`details.resumeUrl`) · `409 QUOTA_FULL` ·
 * `403 EVENT_NOT_PUBLISHED` · `429 RATE_LIMITED`
 *
 * Tanpa body: identitas peserta diambil dari sesi (§3.5).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ eventId: idParam });
type Params = { eventId: string };

export const POST = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  // 20/menit — peredam double-click, bukan pengaman utama (§9.3, §4.4).
  await enforceRateLimit(RATE_LIMITS.enroll, String(user.id));
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { eventId } = parseParams(ctx.params, paramsSchema);
  return created(await enroll(eventId, user.id));
});
