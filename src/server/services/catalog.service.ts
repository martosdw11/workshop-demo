import { sql } from 'drizzle-orm';

import type { CatalogQuery } from '@/lib/validation/event';

import { CACHE_TAGS, CATALOG_TTL_SECONDS, cachedQuery, eventTag } from '../cache/tags';
import { db } from '../db/client';
import type { EnrollmentStatus, EventStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';
import { decodeCursor, encodeCursor, idCursorSchema } from '../http/pagination';

/**
 * Katalog peserta — TDD §3.3 (EPIC 4 story 4.1).
 *
 * Aturan visibilitas: yang tampil adalah event published yang MASIH BERJALAN
 * (belum lewat `end_at`) DITAMBAH semua event yang sudah diikuti peserta —
 * termasuk event yang sudah selesai atau yang ditarik kembali ke draft oleh
 * admin (peserta lama tidak kehilangan akses).
 *
 * Konsekuensinya daftar event kini personal per user, sehingga cache 30 detik
 * di-key per user (userId ikut menjadi argumen `cachedQuery`); detail badge
 * keikutsertaan tetap di-join di luar cache agar selalu segar.
 */

export type EventCard = {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startAt: string;
  endAt: string;
  quota: number | null;
  status: EventStatus;
  enrolledCount: number;
  materialCount: number;
  totalPoints: number;
  /** Badge pojok kartu (PRD §3.A.3). */
  myStatus: 'not_joined' | 'in_progress' | 'completed';
  myEnrollmentId: number | null;
  progressPercent: number | null;
  /** Aksi kontekstual kartu: Join → Resume → View Results. */
  resumeUrl: string | null;
  resultUrl: string | null;
};

type CatalogRow = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  start_at: Date;
  end_at: Date;
  quota: number | null;
  status: EventStatus;
  enrolled_count: number;
  material_count: number;
  total_points: number;
};

/**
 * Visibilitas dasar katalog: event published yang belum berakhir, ATAU event
 * yang sudah diikuti peserta (apa pun statusnya — draft/finished tetap tampil
 * bagi peserta yang sudah bergabung).
 */
const visibleToUser = sql`(
  (e.status = 'published' AND e.end_at >= now()) OR my.id IS NOT NULL
)`;

/**
 * Filter status katalog (§3.3) — turunan dari jadwal `start_at`/`end_at`
 * (asumsi A-11): `finished` dihitung dari `end_at`, tapi nilai enum `finished`
 * tetap dihormati untuk penutupan manual admin. Filter ini bekerja DI DALAM
 * himpunan `visibleToUser`, jadi event finished/draft hanya muncul bagi peserta
 * yang sudah bergabung.
 */
function statusFilter(filter: CatalogQuery['status']) {
  switch (filter) {
    case 'active':
      return sql`e.status <> 'finished' AND e.start_at <= now() AND e.end_at >= now()`;
    case 'upcoming':
      return sql`e.status <> 'finished' AND e.start_at > now()`;
    case 'finished':
      return sql`(e.status = 'finished' OR e.end_at < now())`;
    case 'all':
    default:
      return sql`true`;
  }
}

/**
 * Bagian yang di-cache: daftar event yang terlihat oleh SATU user (userId ikut
 * dalam cache key lewat argumen). Tag `events:list` disegarkan setiap admin
 * mengubah/mempublikasikan event (§7.3); join berikutnya oleh user sendiri
 * menyegarkan tag `event:{id}` sehingga daftar ikut terkoreksi.
 */
const fetchCatalogPage = cachedQuery(
  async (
    userId: number,
    status: CatalogQuery['status'],
    q: string | null,
    cursorId: number | null,
    limit: number,
  ): Promise<CatalogRow[]> => {
    const rows = (await db.execute<CatalogRow>(sql`
      SELECT e.id, e.title, e.description, e.cover_url, e.start_at, e.end_at, e.quota,
             e.status, e.enrolled_count, e.material_count, e.total_points
        FROM events e
        LEFT JOIN enrollments my ON my.event_id = e.id AND my.user_id = ${userId}
       WHERE ${visibleToUser}
         AND ${statusFilter(status)}
         AND (${q}::text IS NULL OR e.title ILIKE '%' || ${q}::text || '%')
         AND (${cursorId}::bigint IS NULL OR e.id < ${cursorId}::bigint)
       ORDER BY e.id DESC
       LIMIT ${limit + 1}
    `)) as unknown as CatalogRow[];
    return rows;
  },
  ['catalog:list'],
  { revalidate: CATALOG_TTL_SECONDS, tags: [CACHE_TAGS.eventList] },
);

type MyEnrollmentRow = {
  id: number;
  event_id: number;
  status: EnrollmentStatus;
  current_material_id: number | null;
  completed_material_count: number;
  total_points: number;
  max_sequence_reached: number;
  joined_at: Date;
  completed_at: Date | null;
};

async function myEnrollmentsFor(
  userId: number,
  eventIds: number[],
): Promise<Map<number, MyEnrollmentRow>> {
  if (eventIds.length === 0) return new Map();

  const list = sql.join(
    eventIds.map((id) => sql`${id}::bigint`),
    sql`, `,
  );
  const rows = (await db.execute<MyEnrollmentRow>(sql`
    SELECT id, event_id, status, current_material_id, completed_material_count,
           total_points, max_sequence_reached, joined_at, completed_at
      FROM enrollments
     WHERE user_id = ${userId} AND event_id IN (${list})
  `)) as unknown as MyEnrollmentRow[];

  return new Map(rows.map((row) => [row.event_id, row]));
}

export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function toCard(row: CatalogRow, mine: MyEnrollmentRow | undefined): EventCard {
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    quota: row.quota,
    status: row.status,
    enrolledCount: row.enrolled_count,
    materialCount: row.material_count,
    totalPoints: row.total_points,
  };

  if (!mine) {
    return {
      ...base,
      myStatus: 'not_joined',
      myEnrollmentId: null,
      progressPercent: null,
      resumeUrl: null,
      resultUrl: null,
    };
  }

  const completed = mine.status === 'completed';
  return {
    ...base,
    myStatus: completed ? 'completed' : 'in_progress',
    myEnrollmentId: mine.id,
    progressPercent: progressPercent(mine.completed_material_count, row.material_count),
    resumeUrl:
      !completed && mine.current_material_id
        ? `/events/${row.id}/materials/${mine.current_material_id}`
        : null,
    resultUrl: completed ? `/events/${row.id}/result` : null,
  };
}

export async function listCatalog(
  userId: number,
  query: CatalogQuery,
): Promise<{ items: EventCard[]; nextCursor: string | null }> {
  const cursor = decodeCursor(query.cursor, idCursorSchema);

  const rows = await fetchCatalogPage(
    userId,
    query.status,
    query.q ?? null,
    cursor?.id ?? null,
    query.limit,
  );

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const mine = await myEnrollmentsFor(
    userId,
    page.map((row) => row.id),
  );

  return {
    items: page.map((row) => toCard(row, mine.get(row.id))),
    nextCursor: hasMore ? encodeCursor({ id: page[page.length - 1].id }) : null,
  };
}

export type MyEnrollmentSummary = {
  id: number;
  eventId: number;
  status: EnrollmentStatus;
  currentMaterialId: number | null;
  maxSequenceReached: number;
  completedMaterialCount: number;
  totalPoints: number;
  progressPercent: number;
  joinedAt: string;
  completedAt: string | null;
  resumeUrl: string | null;
};

export function toMyEnrollment(row: MyEnrollmentRow, materialCount: number): MyEnrollmentSummary {
  return {
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    currentMaterialId: row.current_material_id,
    maxSequenceReached: row.max_sequence_reached,
    completedMaterialCount: row.completed_material_count,
    totalPoints: row.total_points,
    progressPercent: progressPercent(row.completed_material_count, materialCount),
    joinedAt: new Date(row.joined_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    resumeUrl: row.current_material_id
      ? `/events/${row.event_id}/materials/${row.current_material_id}`
      : null,
  };
}

/**
 * `GET /events/:eventId` → `{event, myEnrollment|null}` (§3.3).
 * Event `draft` TIDAK terlihat peserta yang belum bergabung → `404
 * EVENT_NOT_FOUND`, bukan `403`: keberadaan event yang belum dipublikasikan
 * bukan informasi publik. PENGECUALIAN: peserta yang sudah terlanjur join
 * (event ditarik kembali ke draft) tetap boleh membuka event-nya.
 */
export async function getCatalogEvent(
  userId: number,
  eventId: number,
): Promise<{ event: EventCard; myEnrollment: MyEnrollmentSummary | null }> {
  const rows = (await db.execute<CatalogRow>(sql`
    SELECT e.id, e.title, e.description, e.cover_url, e.start_at, e.end_at, e.quota,
           e.status, e.enrolled_count, e.material_count, e.total_points
      FROM events e
     WHERE e.id = ${eventId}
       AND (e.status IN ('published', 'finished')
            OR EXISTS (SELECT 1 FROM enrollments my
                        WHERE my.event_id = e.id AND my.user_id = ${userId}))
  `)) as unknown as CatalogRow[];

  const row = rows[0];
  if (!row) throw new AppError('EVENT_NOT_FOUND');

  const mine = (await myEnrollmentsFor(userId, [eventId])).get(eventId);

  return {
    event: toCard(row, mine),
    myEnrollment: mine ? toMyEnrollment(mine, row.material_count) : null,
  };
}

/** Tag cache per event, dipakai `revalidateTag` saat admin mengubah event (§7.3). */
export const catalogEventTag = eventTag;
