import { adminEventQuerySchema, createEventSchema } from '@/lib/validation/event';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { created, ok, withHandler } from '@/server/http/handler';
import { parseBody, parseQuery } from '@/server/http/validate';
import { createEvent, listAdminEvents } from '@/server/services/event.service';

/**
 * `GET /api/v1/admin/events`  — daftar event admin (§3.4), cursor pagination.
 * `POST /api/v1/admin/events` — buat event baru; selalu lahir sebagai `draft` (§3.B.7 PRD).
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const query = parseQuery(req, adminEventQuerySchema);
  const { items, nextCursor } = await listAdminEvents(query);

  return ok({ items }, { nextCursor });
});

export const POST = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const input = await parseBody(req, createEventSchema);
  const event = await createEvent(input, admin.id);

  return created({ event });
});
