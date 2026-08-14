import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { updateResponseSchema } from '@/lib/validation/response';
import { requireUser } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { created, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams } from '@/server/http/validate';
import { createIssueComment, listIssueComments } from '@/server/services/issue-comment.service';

/**
 * Thread komentar pada respons ISSUE.
 *
 * `GET  /api/v1/responses/:id/comments` — `200 {items}` (kronologis naik)
 * `POST /api/v1/responses/:id/comments` — `201 {comment}`
 *
 * `requireUser`, BUKAN `requireParticipant`: admin ikut membantu di thread.
 * Otorisasi rinci di service: peserta wajib ter-enroll pada event pemilik
 * issue (`403`), thread hanya untuk `type='issue'` (`422 NOT_AN_ISSUE`),
 * peserta yang sudah finish read-only (`403 ENROLLMENT_COMPLETED`).
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ responseId: idParam });
type Params = { responseId: string };

export const GET = withHandler<Params>(async (_req, ctx) => {
  const user = await requireUser();
  ctx.setUserId(user.id);

  const { responseId } = parseParams(ctx.params, paramsSchema);
  return ok(await listIssueComments(responseId, user));
});

export const POST = withHandler<Params>(async (req, ctx) => {
  const user = await requireUser();
  ctx.setUserId(user.id);

  // Limiter yang sama dengan POST respons — tabel yang tumbuh cepat (§9.3).
  await enforceRateLimit(RATE_LIMITS.response, String(user.id));
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { responseId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, updateResponseSchema);

  return created({ comment: await createIssueComment(responseId, user, input) });
});
