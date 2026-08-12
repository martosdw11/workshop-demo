import { sql } from 'drizzle-orm';

import type { SessionUser } from '../auth/session';
import { revalidateEvent } from '../cache/tags';
import { db } from '../db/client';
import type { EnrollmentStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';
import { progressPercent } from './catalog.service';
import {
  isMaterialLocked,
  requireOwnEnrollment,
  requireOwnEnrollmentForMaterial,
  type EnrollmentContext,
} from './player.access';

/**
 * Learning Player — TDD §3.3, §4.5 (EPIC 5 story 5.1, 5.4, 5.5).
 *
 * Semua penentuan lock memakai satu aturan: materi terbuka bila
 * `sequence_index <= enrollments.max_sequence_reached`, dan `max_sequence_reached`
 * tidak pernah turun.
 */

export type PathNode = {
  id: number;
  parentId: number | null;
  depth: number;
  title: string;
  points: number;
  sequenceIndex: number;
  /** Tiga state ikon sidebar (§6.6): check / play / lock. */
  state: 'completed' | 'active' | 'locked';
  pointsEarned: number | null;
  children: PathNode[];
};

type PathRow = {
  id: number;
  parent_id: number | null;
  depth: number;
  title: string;
  points: number;
  sequence_index: number;
  points_earned: number | null;
  completed: boolean;
};

function toEnrollmentPayload(ctx: EnrollmentContext) {
  return {
    id: ctx.enrollmentId,
    eventId: ctx.eventId,
    eventTitle: ctx.eventTitle,
    status: ctx.status,
    currentMaterialId: ctx.currentMaterialId,
    maxSequenceReached: ctx.maxSequenceReached,
    completedMaterialCount: ctx.completedMaterialCount,
    materialsTotal: ctx.materialCount,
    totalPoints: ctx.totalPoints,
    pointsAvailable: ctx.eventTotalPoints,
    isReadOnly: ctx.status === 'completed',
    joinedAt: ctx.joinedAt.toISOString(),
    completedAt: ctx.completedAt?.toISOString() ?? null,
  };
}

/** `GET /enrollments/:id` → `{enrollment, path, progressPercent}` (§3.3). */
export async function getEnrollmentDetail(enrollmentId: number, user: SessionUser) {
  const ctx = await requireOwnEnrollment(enrollmentId, user);

  const rows = (await db.execute<PathRow>(sql`
    SELECT m.id, m.parent_id, m.depth, m.title, m.points, m.sequence_index,
           mp.points_earned,
           (mp.id IS NOT NULL) AS completed
      FROM materials m
      LEFT JOIN material_progress mp
        ON mp.material_id = m.id AND mp.enrollment_id = ${enrollmentId}
     WHERE m.event_id = ${ctx.eventId}
     ORDER BY m.sequence_index
  `)) as unknown as PathRow[];

  const nodes = new Map<number, PathNode>();
  const path: PathNode[] = [];

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      depth: row.depth,
      title: row.title,
      points: row.points,
      sequenceIndex: row.sequence_index,
      state: row.completed
        ? 'completed'
        : isMaterialLocked({ sequenceIndex: row.sequence_index }, ctx)
          ? 'locked'
          : 'active',
      pointsEarned: row.points_earned,
      children: [],
    });
  }

  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    if (row.parent_id === null) path.push(node);
    else nodes.get(row.parent_id)?.children.push(node);
  }

  return {
    enrollment: toEnrollmentPayload(ctx),
    path,
    progressPercent: progressPercent(ctx.completedMaterialCount, ctx.materialCount),
  };
}

/**
 * `GET /materials/:materialId` →
 * `{material, isLocked, isReadOnly, pointsEarned, prevId, nextId, isLast}` (§3.3).
 *
 * Materi terkunci ditolak `403 MATERIAL_LOCKED`; field `isLocked` tetap
 * dikembalikan di respons sukses (selalu `false` di sana) karena ia bagian dari
 * bentuk payload yang dijanjikan kontrak.
 */
export async function getMaterialForParticipant(materialId: number, user: SessionUser) {
  const { material, enrollment } = await requireOwnEnrollmentForMaterial(materialId, user);

  if (isMaterialLocked(material, enrollment)) throw new AppError('MATERIAL_LOCKED');

  const neighbours = (await db.execute<{ prev_id: number | null; next_id: number | null }>(sql`
    SELECT (SELECT id FROM materials
             WHERE event_id = ${material.eventId} AND sequence_index < ${material.sequenceIndex}
             ORDER BY sequence_index DESC LIMIT 1) AS prev_id,
           (SELECT id FROM materials
             WHERE event_id = ${material.eventId} AND sequence_index > ${material.sequenceIndex}
             ORDER BY sequence_index LIMIT 1) AS next_id
  `)) as unknown as { prev_id: number | null; next_id: number | null }[];

  const progressRows = (await db.execute<{ points_earned: number }>(sql`
    SELECT points_earned FROM material_progress
     WHERE enrollment_id = ${enrollment.enrollmentId} AND material_id = ${materialId}
  `)) as unknown as { points_earned: number }[];

  const { prev_id: prevId, next_id: nextId } = neighbours[0];

  return {
    material: {
      id: material.materialId,
      eventId: material.eventId,
      parentId: material.parentId,
      depth: material.depth,
      title: material.title,
      points: material.points,
      sequenceIndex: material.sequenceIndex,
      // Peserta selalu menerima HTML yang SUDAH tersanitasi (§8.4); `content_json`
      // hanya dibutuhkan editor admin dan tidak dikirim ke sini.
      contentHtml: material.contentHtml,
    },
    enrollmentId: enrollment.enrollmentId,
    isLocked: false,
    isReadOnly: enrollment.status === 'completed',
    pointsEarned: progressRows[0]?.points_earned ?? null,
    prevId,
    nextId,
    isLast: nextId === null,
  };
}

export type FinishResult = {
  enrollment: {
    id: number;
    status: EnrollmentStatus;
    totalPoints: number;
    completedAt: string | null;
  };
  summary: {
    eventTitle: string;
    materialsCompleted: number;
    materialsTotal: number;
    pointsEarned: number;
    pointsAvailable: number;
    userTotalPoints: number;
  };
  readOnly: boolean;
  redirectTo: string;
};

/**
 * `POST /enrollments/:id/finish` — §3.5 (4), §4.5.
 *
 * IDEMPOTEN: pemanggilan kedua mengembalikan payload sukses yang sama dan
 * `completed_at` TIDAK berubah. Itu dijamin `WHERE ... AND status = 'in_progress'`
 * pada UPDATE — bukan oleh pengecekan sebelum UPDATE yang bisa kalah balapan.
 *
 * Guard `403 NOT_AT_LAST_MATERIAL`: Finish hanya sah bila seluruh materi selesai
 * DAN posisi peserta ada di materi dengan `sequence_index` maksimum (§4.5).
 */
export async function finishEnrollment(
  enrollmentId: number,
  user: SessionUser,
): Promise<FinishResult> {
  const result = await db.transaction(async (tx) => {
    const ctx = await requireOwnEnrollment(enrollmentId, user, tx);

    const lockedRows = (await tx.execute<{
      id: number;
      status: EnrollmentStatus;
      total_points: number;
      completed_material_count: number;
      current_material_id: number | null;
      completed_at: Date | null;
    }>(sql`
      SELECT id, status, total_points, completed_material_count,
             current_material_id, completed_at
        FROM enrollments WHERE id = ${enrollmentId} FOR UPDATE
    `)) as unknown as {
      id: number;
      status: EnrollmentStatus;
      total_points: number;
      completed_material_count: number;
      current_material_id: number | null;
      completed_at: Date | null;
    }[];

    const enrollment = lockedRows[0];
    if (!enrollment) throw new AppError('NOT_FOUND');

    if (enrollment.status === 'in_progress') {
      const lastRows = (await tx.execute<{ id: number }>(sql`
        SELECT id FROM materials
         WHERE event_id = ${ctx.eventId}
         ORDER BY sequence_index DESC LIMIT 1
      `)) as unknown as { id: number }[];

      const atLastMaterial =
        lastRows[0] !== undefined && enrollment.current_material_id === lastRows[0].id;
      const allCompleted =
        ctx.materialCount > 0 && enrollment.completed_material_count >= ctx.materialCount;

      if (!allCompleted || !atLastMaterial) {
        throw new AppError('NOT_AT_LAST_MATERIAL', {
          completedMaterialCount: enrollment.completed_material_count,
          materialsTotal: ctx.materialCount,
        });
      }

      await tx.execute(sql`
        UPDATE enrollments
           SET status = 'completed', completed_at = now(), last_activity_at = now()
         WHERE id = ${enrollmentId} AND status = 'in_progress'
      `);
    }

    const finalRows = (await tx.execute<{
      status: EnrollmentStatus;
      total_points: number;
      completed_material_count: number;
      completed_at: Date | null;
      user_total_points: number;
    }>(sql`
      SELECT en.status, en.total_points, en.completed_material_count, en.completed_at,
             u.total_points AS user_total_points
        FROM enrollments en JOIN users u ON u.id = en.user_id
       WHERE en.id = ${enrollmentId}
    `)) as unknown as {
      status: EnrollmentStatus;
      total_points: number;
      completed_material_count: number;
      completed_at: Date | null;
      user_total_points: number;
    }[];

    const final = finalRows[0];

    return {
      enrollment: {
        id: enrollmentId,
        status: final.status,
        totalPoints: final.total_points,
        completedAt: final.completed_at ? new Date(final.completed_at).toISOString() : null,
      },
      summary: {
        eventTitle: ctx.eventTitle,
        materialsCompleted: final.completed_material_count,
        materialsTotal: ctx.materialCount,
        pointsEarned: final.total_points,
        pointsAvailable: ctx.eventTotalPoints,
        userTotalPoints: final.user_total_points,
      },
      readOnly: true,
      redirectTo: `/events/${ctx.eventId}/result`,
      eventId: ctx.eventId,
    };
  });

  // Segmen Completed di Event Pipeline admin ikut berubah (§7.5).
  revalidateEvent(result.eventId);

  const { eventId: _eventId, ...payload } = result;
  return payload;
}

export type ParticipantDashboard = {
  kpi: {
    totalEventsJoined: number;
    activeEvents: number;
    completedEvents: number;
    totalPoints: number;
  };
  continueLearning: {
    enrollmentId: number;
    eventId: number;
    eventTitle: string;
    coverUrl: string | null;
    progressPercent: number;
    resumeHref: string;
  } | null;
  achievements: {
    enrollmentId: number;
    eventId: number;
    eventTitle: string;
    completedAt: string | null;
    pointsEarned: number;
    pointsAvailable: number;
    progressPercent: number;
  }[];
};

/** `GET /me/dashboard` — 4 KPI + Continue Learning + Achievement History (§3.3, PRD §3.A.2). */
export async function getParticipantDashboard(user: SessionUser): Promise<ParticipantDashboard> {
  const kpiRows = (await db.execute<{
    total_joined: number;
    active_events: number;
    completed_events: number;
    total_points: number;
  }>(sql`
    SELECT count(*)::int AS total_joined,
           count(*) FILTER (WHERE en.status = 'in_progress')::int AS active_events,
           count(*) FILTER (WHERE en.status = 'completed')::int   AS completed_events,
           (SELECT total_points FROM users WHERE id = ${user.id})::int AS total_points
      FROM enrollments en
     WHERE en.user_id = ${user.id}
  `)) as unknown as {
    total_joined: number;
    active_events: number;
    completed_events: number;
    total_points: number;
  }[];

  // Index #4 `(user_id, joined_at DESC)` melayani kedua query di bawah.
  const continueRows = (await db.execute<{
    enrollment_id: number;
    event_id: number;
    title: string;
    cover_url: string | null;
    completed_material_count: number;
    material_count: number;
    current_material_id: number | null;
  }>(sql`
    SELECT en.id AS enrollment_id, ev.id AS event_id, ev.title, ev.cover_url,
           en.completed_material_count, ev.material_count, en.current_material_id
      FROM enrollments en JOIN events ev ON ev.id = en.event_id
     WHERE en.user_id = ${user.id} AND en.status = 'in_progress'
     ORDER BY en.last_activity_at DESC
     LIMIT 1
  `)) as unknown as {
    enrollment_id: number;
    event_id: number;
    title: string;
    cover_url: string | null;
    completed_material_count: number;
    material_count: number;
    current_material_id: number | null;
  }[];

  const achievementRows = (await db.execute<{
    enrollment_id: number;
    event_id: number;
    title: string;
    completed_at: Date | null;
    total_points: number;
    event_total_points: number;
  }>(sql`
    SELECT en.id AS enrollment_id, ev.id AS event_id, ev.title, en.completed_at,
           en.total_points, ev.total_points AS event_total_points
      FROM enrollments en JOIN events ev ON ev.id = en.event_id
     WHERE en.user_id = ${user.id} AND en.status = 'completed'
     ORDER BY en.completed_at DESC NULLS LAST
     LIMIT 20
  `)) as unknown as {
    enrollment_id: number;
    event_id: number;
    title: string;
    completed_at: Date | null;
    total_points: number;
    event_total_points: number;
  }[];

  const kpi = kpiRows[0];
  const cont = continueRows[0];

  return {
    kpi: {
      totalEventsJoined: kpi?.total_joined ?? 0,
      activeEvents: kpi?.active_events ?? 0,
      completedEvents: kpi?.completed_events ?? 0,
      totalPoints: kpi?.total_points ?? user.totalPoints,
    },
    continueLearning: cont
      ? {
          enrollmentId: cont.enrollment_id,
          eventId: cont.event_id,
          eventTitle: cont.title,
          coverUrl: cont.cover_url,
          progressPercent: progressPercent(cont.completed_material_count, cont.material_count),
          resumeHref: cont.current_material_id
            ? `/events/${cont.event_id}/materials/${cont.current_material_id}`
            : `/events/${cont.event_id}`,
        }
      : null,
    achievements: achievementRows.map((row) => ({
      enrollmentId: row.enrollment_id,
      eventId: row.event_id,
      eventTitle: row.title,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      pointsEarned: row.total_points,
      pointsAvailable: row.event_total_points,
      progressPercent: 100,
    })),
  };
}
