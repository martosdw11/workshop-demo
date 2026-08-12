import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { issueStatusSchema } from '@/lib/validation/response';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { updateIssueStatus } from '@/server/services/event-detail.service';

/**
 * `PATCH /api/v1/admin/responses/:id/issue-status` — §3.4.
 * `200 {response}` · `422 NOT_AN_ISSUE`
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ responseId: idParam });
type Params = { responseId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const { responseId } = parseParams(ctx.params, paramsSchema);
  const { issueStatus } = await parseBody(req, issueStatusSchema);

  return ok({ response: await updateIssueStatus(responseId, issueStatus) });
});
