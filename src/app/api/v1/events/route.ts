import { catalogQuerySchema } from '@/lib/validation/event';
import { requireParticipant } from '@/server/auth/rbac';
import { ok, withHandler } from '@/server/http/handler';
import { parseQuery } from '@/server/http/validate';
import { listCatalog } from '@/server/services/catalog.service';

/**
 * `GET /api/v1/events` — Event Catalog peserta (§3.3).
 * `?status=all|active|upcoming|finished&q=&cursor=&limit=12`
 *
 * Daftar event-nya di-cache 30 detik (§1.2); badge keikutsertaan di-join per user
 * DI LUAR cache, karena bagian itu personal.
 */
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const user = await requireParticipant();
  ctx.setUserId(user.id);

  const query = parseQuery(req, catalogQuerySchema);
  const { items, nextCursor } = await listCatalog(user.id, query);

  return ok({ items }, { nextCursor });
});
