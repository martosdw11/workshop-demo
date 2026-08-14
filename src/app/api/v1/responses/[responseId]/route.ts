import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { updateResponseSchema } from '@/lib/validation/response';
import { requireParticipant } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { noContent, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { deleteOwnIssueResponse, updateOwnIssueResponse } from '@/server/services/response.service';

/**
 * Edit/hapus respons ISSUE milik sendiri (fitur edit issue).
 *
 * `PATCH  /api/v1/responses/:id` — `200 {response}`
 * `DELETE /api/v1/responses/:id` — `204`
 *
 * Guard di service: `404` bila tak ada, `403 FORBIDDEN` bila bukan milik
 * pemanggil, `422 NOT_AN_ISSUE` untuk `answer`/`comment` (tetap immutable bagi
 * peserta), `403 ENROLLMENT_COMPLETED` setelah finish (§4.5).
 * Admin memakai `DELETE /api/v1/admin/responses/:id`, bukan endpoint ini.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ responseId: idParam });
type Params = { responseId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { responseId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, updateResponseSchema);

  return ok({ response: await updateOwnIssueResponse(responseId, user, input) });
});

export const DELETE = withHandler<Params>(async (_req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { responseId } = parseParams(ctx.params, paramsSchema);
  await deleteOwnIssueResponse(responseId, user);

  return noContent();
});
