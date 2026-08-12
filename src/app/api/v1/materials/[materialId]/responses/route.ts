import { z } from 'zod';

import { idParam } from '@/lib/validation/common';
import { createResponseSchema, responseListQuerySchema } from '@/lib/validation/response';
import { requireParticipant } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { created, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseParams, parseQuery } from '@/server/http/validate';
import { createResponse, listResponses } from '@/server/services/response.service';

/**
 * `GET  /api/v1/materials/:materialId/responses` — cursor 20 item (§3.3)
 * `POST /api/v1/materials/:materialId/responses` — §3.5 (2)
 *        `403 ENROLLMENT_COMPLETED` · `403 MATERIAL_LOCKED` · `422` · `429`
 *
 * POST sengaja TIDAK idempoten (§4.4): peserta boleh mengirim tanpa batas.
 * Endpoint baca TIDAK diberi rate limit (§9.3) agar belajar tidak terganggu.
 */
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ materialId: idParam });
type Params = { materialId: string };

export const GET = withHandler<Params>(async (req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  const { materialId } = parseParams(ctx.params, paramsSchema);
  const query = parseQuery(req, responseListQuerySchema);
  const { items, nextCursor } = await listResponses(materialId, user, query);

  return ok({ items }, { nextCursor });
});

export const POST = withHandler<Params>(async (req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  // 10/menit/peserta — melindungi tabel yang tumbuh paling cepat (§9.3, PRD §7.2).
  await enforceRateLimit(RATE_LIMITS.response, String(user.id));
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(user.id));

  const { materialId } = parseParams(ctx.params, paramsSchema);
  const input = await parseBody(req, createResponseSchema);

  return created(await createResponse(materialId, user, input));
});
