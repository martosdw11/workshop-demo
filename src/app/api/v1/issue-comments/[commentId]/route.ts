import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { updateResponseSchema } from '@/lib/validation/response';
import { requireUser } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { noContent, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { deleteIssueComment, updateOwnIssueComment } from '@/server/services/issue-comment.service';

/**
 * Mutasi komentar thread issue.
 *
 * `PATCH  /api/v1/issue-comments/:id` — `200 {comment}` — hanya penulisnya.
 * `DELETE /api/v1/issue-comments/:id` — `204` — penulisnya ATAU admin
 * (all-access moderasi).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ commentId: idParam });
type Params = { commentId: string };

export const PATCH = withHandler<Params>(async (req, ctx) => {
  const user = await requireUser();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { commentId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, updateResponseSchema);

  return ok({ comment: await updateOwnIssueComment(commentId, user, input) });
});

export const DELETE = withHandler<Params>(async (_req, ctx) => {
  const user = await requireUser();
  ctx.setUserId(user.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { commentId } = parseParams(ctx.params, paramsSchema);
  await deleteIssueComment(commentId, user);

  return noContent();
});
