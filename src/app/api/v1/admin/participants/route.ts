import { participantQuerySchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseQuery } from '@/server/http/validate';
import { listPeople } from '@/server/services/user.service';

/**
 * `GET /api/v1/admin/participants` — §3.4.
 * `?q=&status=&cursor=&limit=10` → `200 {items:[{user,eventsJoined,totalPoints,status}], nextCursor}`
 *
 * A-B10: mengembalikan seluruh user beserta `role`, karena ini satu-satunya
 * endpoint daftar orang di §3.4 dan User Access (story 7.3) juga memerlukannya.
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);

  const query = parseQuery(req, participantQuerySchema);
  const { items, nextCursor } = await listPeople(query);

  return ok({ items }, { nextCursor });
});
