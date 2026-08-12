import { sql } from 'drizzle-orm';

import type { DashboardPeriod } from '@/lib/constants';
import type { ActivityQuery } from '@/lib/validation/response';
import type { PipelineQuery } from '@/lib/validation/user';

import { CACHE_TAGS, cachedQuery, dashboardTtlSeconds, eventTag } from '../cache/tags';
import { db } from '../db/client';
import type { ResponseType } from '../db/schema/enums';
import { env } from '../env';
import { decodeCursor, sliceWithCursor, timeCursorSchema } from '../http/pagination';
import { initialsOf } from './response.service';

/**
 * Monitoring admin — TDD §7 (EPIC 6).
 *
 * TIDAK ADA tabel agregat, TIDAK ADA worker, TIDAK ADA job rekonsiliasi (A-08).
 * Seluruh angka dihitung dari tiga query agregat langsung §7.2 (a/b/c) ke tabel
 * transaksional, dibungkus `unstable_cache` TTL `DASHBOARD_CACHE_TTL_SECONDS`
 * dengan tag `event:{id}`.
 *
 * Konsekuensinya angka dashboard TIDAK MUNGKIN melenceng: kelas bug yang dulu
 * perlu job rekonsiliasi untuk memperbaikinya kini tidak bisa terjadi.
 *
 * Keterlambatan worst-case = TTL cache 30 detik + polling klien 30 detik
 * = ≤ 60 detik, sesuai SLO §7.2 PRD.
 */

/** Ambang klasifikasi "Stalled" (§7.5), dikalibrasi lewat env. */
const stalledDays = () => env.STALLED_THRESHOLD_DAYS;

/**
 * ASUMSI EKSPLISIT (A-B09): §3.4 menyediakan filter `period` tanpa mendefinisikan
 * rumusnya. Ditetapkan sebagai awal jendela waktu relatif terhadap `now()`:
 * `7d`/`30d` = N hari ke belakang, `quarter` = 90 hari, `ytd` = 1 Januari tahun berjalan.
 */
function periodStart(period: DashboardPeriod) {
  switch (period) {
    case '30d':
      return sql`now() - interval '30 days'`;
    case 'quarter':
      return sql`now() - interval '90 days'`;
    case 'ytd':
      return sql`date_trunc('year', now())`;
    case '7d':
    default:
      return sql`now() - interval '7 days'`;
  }
}

export type DashboardKpi = {
  totalEvents: number;
  activeToday: number;
  upcomingWeek: number;
  totalParticipants: number;
};

/**
 * 4 KPI Bento Grid (PRD §3.B.6, kontrak §3.4).
 *
 * A-B09 — definisi tiap angka:
 *  - `totalEvents`       : event yang DIBUAT dalam periode ("Generated").
 *  - `activeToday`       : event `published` yang sedang berjalan hari ini
 *                          (tidak bergantung periode — "Today" sudah menyebut jendelanya).
 *  - `upcomingWeek`      : event `published` yang mulai dalam 7 hari ke depan.
 *  - `totalParticipants` : peserta UNIK yang join dalam periode.
 */
const kpiQuery = cachedQuery(
  async (period: DashboardPeriod): Promise<DashboardKpi> => {
    const rows = (await db.execute<DashboardKpi>(sql`
      SELECT
        (SELECT count(*)::int FROM events
          WHERE created_at >= ${periodStart(period)})                       AS "totalEvents",
        (SELECT count(*)::int FROM events
          WHERE status = 'published' AND start_at <= now() AND end_at >= now()) AS "activeToday",
        (SELECT count(*)::int FROM events
          WHERE status = 'published'
            AND start_at > now() AND start_at <= now() + interval '7 days')  AS "upcomingWeek",
        (SELECT count(DISTINCT user_id)::int FROM enrollments
          WHERE joined_at >= ${periodStart(period)})                        AS "totalParticipants"
    `)) as unknown as DashboardKpi[];

    return (
      rows[0] ?? { totalEvents: 0, activeToday: 0, upcomingWeek: 0, totalParticipants: 0 }
    );
  },
  ['admin:kpi'],
  { revalidate: dashboardTtlSeconds(), tags: [CACHE_TAGS.dashboard] },
);

export const getDashboardKpi = (period: DashboardPeriod) => kpiQuery(period);

export type PipelineItem = {
  eventId: number;
  title: string;
  total: number;
  completed: number;
  inProgress: number;
  stalled: number;
};

type PipelineRow = {
  event_id: number;
  title: string;
  completed: number;
  in_progress: number;
  stalled: number;
};

/**
 * Query §7.2 (a) — Pipeline Summary per event. Berjalan di atas index #5
 * `(event_id, status)`.
 *
 * Klasifikasi §7.5:
 *  - Completed   : `status = 'completed'`
 *  - In Progress : `status = 'in_progress'` DAN `last_activity_at >= now() - N hari`
 *  - Stalled     : `status = 'in_progress'` DAN `last_activity_at <  now() - N hari`
 */
const pipelineQuery = cachedQuery(
  async (
    period: DashboardPeriod,
    eventId: number | null,
    days: number,
  ): Promise<PipelineItem[]> => {
    const rows = (await db.execute<PipelineRow>(sql`
      SELECT e.id AS event_id, e.title,
             count(*) FILTER (WHERE en.status = 'completed')::int AS completed,
             count(*) FILTER (WHERE en.status = 'in_progress'
                                AND en.last_activity_at >= now() - (${days} || ' days')::interval
                             )::int AS in_progress,
             count(*) FILTER (WHERE en.status = 'in_progress'
                                AND en.last_activity_at <  now() - (${days} || ' days')::interval
                             )::int AS stalled
        FROM events e
        JOIN enrollments en ON en.event_id = e.id
       WHERE e.status = 'published'
         AND en.joined_at >= ${periodStart(period)}
         AND (${eventId}::bigint IS NULL OR e.id = ${eventId}::bigint)
       GROUP BY e.id, e.title
       ORDER BY e.id DESC
    `)) as unknown as PipelineRow[];

    return rows.map((row) => ({
      eventId: row.event_id,
      title: row.title,
      total: row.completed + row.in_progress + row.stalled,
      completed: row.completed,
      inProgress: row.in_progress,
      stalled: row.stalled,
    }));
  },
  ['admin:pipeline'],
  { revalidate: dashboardTtlSeconds(), tags: [CACHE_TAGS.dashboard] },
);

export const getPipelineSummary = (query: PipelineQuery) =>
  pipelineQuery(query.period, query.eventId ?? null, stalledDays());

export type MaterialDrilldownItem = {
  materialId: number;
  title: string;
  depth: number;
  participantCount: number;
  completedCount: number;
  openIssueCount: number;
};

type DrilldownRow = {
  material_id: number;
  title: string;
  depth: number;
  participant_count: number;
  completed_count: number;
  open_issue_count: number;
};

/**
 * Query §7.2 (b) — sebaran peserta per materi ("Materi 3.2 — 42 peserta").
 * Index #6 `(event_id, current_material_id)` inilah yang membuat agregat ini bisa
 * dihitung langsung tanpa tabel agregat; `completed_count` memakai index #10.
 *
 * `open_issue_count` ditambahkan karena kontrak §3.4 memintanya di payload
 * drill-down; ia dilayani partial index #14.
 */
const drilldownQuery = cachedQuery(
  async (eventId: number): Promise<MaterialDrilldownItem[]> => {
    const rows = (await db.execute<DrilldownRow>(sql`
      SELECT m.id AS material_id, m.title, m.depth,
             count(en.id) FILTER (WHERE en.status = 'in_progress')::int AS participant_count,
             (SELECT count(*)::int FROM material_progress mp
               WHERE mp.material_id = m.id)                             AS completed_count,
             (SELECT count(*)::int FROM responses r
               WHERE r.material_id = m.id
                 AND r.type = 'issue' AND r.issue_status = 'open')      AS open_issue_count
        FROM materials m
        LEFT JOIN enrollments en ON en.current_material_id = m.id
       WHERE m.event_id = ${eventId}
       GROUP BY m.id, m.title, m.depth, m.sequence_index
       ORDER BY m.sequence_index
    `)) as unknown as DrilldownRow[];

    return rows.map((row) => ({
      materialId: row.material_id,
      title: row.title,
      depth: row.depth,
      participantCount: row.participant_count,
      completedCount: row.completed_count,
      openIssueCount: row.open_issue_count,
    }));
  },
  ['admin:drilldown'],
  { revalidate: dashboardTtlSeconds(), tags: [CACHE_TAGS.dashboard] },
);

export async function getMaterialDrilldown(eventId: number) {
  const rows = (await db.execute<{ ada: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM events WHERE id = ${eventId}) AS ada
  `)) as unknown as { ada: boolean }[];
  if (!rows[0]?.ada) {
    const { AppError } = await import('../http/errors');
    throw new AppError('EVENT_NOT_FOUND');
  }

  return {
    items: await drilldownQuery(eventId),
    // Dipakai UI untuk menampilkan "data per <waktu>" — konsekuensi cache 30 detik.
    generatedAt: new Date().toISOString(),
  };
}

export type ActivityItem = {
  id: number;
  type: ResponseType;
  content: string;
  createdAt: string;
  materialId: number;
  materialTitle: string;
  eventId: number;
  issueStatus: 'open' | 'resolved' | null;
  user: { id: number; name: string; initials: string };
  href: string;
};

type ActivityRow = {
  id: number;
  type: ResponseType;
  content: string;
  created_at: Date;
  material_id: number;
  material_title: string;
  event_id: number;
  issue_status: 'open' | 'resolved' | null;
  user_id: number;
  name: string;
};

/**
 * Query §7.2 (c) — Recent Activity Feed. Index #11 & partial index #14.
 *
 * CATATAN KETIDAKSESUAIAN (dilaporkan, tidak ditambal diam-diam): PRD §3.B.6
 * menyebut feed juga memuat "event yang diselesaikan peserta", sementara query
 * §7.2 (c) — yang epic ini diminta pakai apa adanya — hanya membaca tabel
 * `responses`. Implementasi mengikuti §7.2 (c); menambah UNION ke `enrollments`
 * akan mengubah query yang secara eksplisit ditetapkan TDD.
 *
 * `cursor` ditambahkan sesuai kontrak §3.4 (`?eventId=&cursor=&limit=20`);
 * bentuk dan urutan query-nya tidak berubah.
 */
export async function getRecentActivity(
  query: ActivityQuery,
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  const cursor = decodeCursor(query.cursor, timeCursorSchema);
  const eventId = query.eventId ?? null;

  const rows = (await db.execute<ActivityRow>(sql`
    SELECT r.id, r.type, r.content, r.created_at, r.material_id, r.issue_status,
           m.title AS material_title, m.event_id,
           u.id AS user_id, u.name
      FROM responses r
      JOIN users u ON u.id = r.user_id
      JOIN materials m ON m.id = r.material_id
     WHERE (${eventId}::bigint IS NULL OR m.event_id = ${eventId}::bigint)
       AND (
         ${cursor?.at ?? null}::timestamptz IS NULL
         OR (r.created_at, r.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::bigint)
       )
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ${query.limit + 1}
  `)) as unknown as ActivityRow[];

  const page = sliceWithCursor(rows, query.limit, (row) => ({
    at: new Date(row.created_at).toISOString(),
    id: row.id,
  }));

  return {
    items: page.items.map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
      materialId: row.material_id,
      materialTitle: row.material_title,
      eventId: row.event_id,
      issueStatus: row.issue_status,
      user: { id: row.user_id, name: row.name, initials: initialsOf(row.name) },
      // Tiap item menaut ke materi terkait (§6.8).
      href: `/admin/events/${row.event_id}/responses?materialId=${row.material_id}`,
    })),
    nextCursor: page.nextCursor,
  };
}

export const dashboardEventTag = eventTag;
