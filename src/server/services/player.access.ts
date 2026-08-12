import { sql } from 'drizzle-orm';

import { assertOwnership } from '../auth/guard';
import type { SessionUser } from '../auth/session';
import { db, type DbExecutor } from '../db/client';
import type { EnrollmentStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';

/**
 * Resolusi akses Learning Player — TDD §5.2 baris "Service layer".
 *
 * Semua endpoint peserta (`/materials/*`, `/enrollments/*`) melewati salah satu
 * fungsi di sini, sehingga cek kepemilikan resource tidak bisa terlewat di satu
 * handler saja. Perlindungan IDOR: peserta A tidak bisa membuka enrollment atau
 * materi milik peserta B walau tahu ID-nya.
 */

export type EnrollmentContext = {
  enrollmentId: number;
  userId: number;
  eventId: number;
  eventTitle: string;
  status: EnrollmentStatus;
  currentMaterialId: number | null;
  maxSequenceReached: number;
  completedMaterialCount: number;
  totalPoints: number;
  materialCount: number;
  eventTotalPoints: number;
  joinedAt: Date;
  completedAt: Date | null;
};

type ContextRow = {
  enrollment_id: number;
  user_id: number;
  event_id: number;
  event_title: string;
  status: EnrollmentStatus;
  current_material_id: number | null;
  max_sequence_reached: number;
  completed_material_count: number;
  total_points: number;
  material_count: number;
  event_total_points: number;
  joined_at: Date;
  completed_at: Date | null;
};

const SELECT_CONTEXT = sql`
  SELECT en.id                       AS enrollment_id,
         en.user_id,
         en.event_id,
         ev.title                    AS event_title,
         en.status,
         en.current_material_id,
         en.max_sequence_reached,
         en.completed_material_count,
         en.total_points,
         ev.material_count,
         ev.total_points             AS event_total_points,
         en.joined_at,
         en.completed_at
    FROM enrollments en
    JOIN events ev ON ev.id = en.event_id
`;

function toContext(row: ContextRow): EnrollmentContext {
  return {
    enrollmentId: row.enrollment_id,
    userId: row.user_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    status: row.status,
    currentMaterialId: row.current_material_id,
    maxSequenceReached: row.max_sequence_reached,
    completedMaterialCount: row.completed_material_count,
    totalPoints: row.total_points,
    materialCount: row.material_count,
    eventTotalPoints: row.event_total_points,
    joinedAt: new Date(row.joined_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

/** Enrollment berdasarkan ID-nya sendiri (`GET /enrollments/:id`). */
export async function requireOwnEnrollment(
  enrollmentId: number,
  user: SessionUser,
  tx: DbExecutor = db,
): Promise<EnrollmentContext> {
  const rows = (await tx.execute<ContextRow>(sql`
    ${SELECT_CONTEXT} WHERE en.id = ${enrollmentId}
  `)) as unknown as ContextRow[];

  const row = rows[0];
  if (!row) throw new AppError('NOT_FOUND');

  assertOwnership(row.user_id, user);
  return toContext(row);
}

export type MaterialContext = {
  materialId: number;
  eventId: number;
  parentId: number | null;
  depth: number;
  title: string;
  points: number;
  sequenceIndex: number;
  contentJson: unknown;
  contentHtml: string | null;
};

type MaterialRow = {
  id: number;
  event_id: number;
  parent_id: number | null;
  depth: number;
  title: string;
  points: number;
  sequence_index: number;
  content_json: unknown;
  content_html: string | null;
};

/**
 * Enrollment milik peserta pada event tempat materi ini berada.
 * Peserta yang belum join event tersebut mendapat `403 FORBIDDEN` — bukan
 * `404`, karena materinya memang ada, hanya bukan haknya.
 */
export async function requireOwnEnrollmentForMaterial(
  materialId: number,
  user: SessionUser,
  tx: DbExecutor = db,
): Promise<{ material: MaterialContext; enrollment: EnrollmentContext }> {
  const materialRows = (await tx.execute<MaterialRow>(sql`
    SELECT id, event_id, parent_id, depth, title, points, sequence_index,
           content_json, content_html
      FROM materials WHERE id = ${materialId}
  `)) as unknown as MaterialRow[];

  const materialRow = materialRows[0];
  if (!materialRow) throw new AppError('MATERIAL_NOT_FOUND');

  const rows = (await tx.execute<ContextRow>(sql`
    ${SELECT_CONTEXT} WHERE en.event_id = ${materialRow.event_id} AND en.user_id = ${user.id}
  `)) as unknown as ContextRow[];

  const row = rows[0];
  if (!row) throw new AppError('FORBIDDEN');

  return {
    material: {
      materialId: materialRow.id,
      eventId: materialRow.event_id,
      parentId: materialRow.parent_id,
      depth: materialRow.depth,
      title: materialRow.title,
      points: materialRow.points,
      sequenceIndex: materialRow.sequence_index,
      contentJson: materialRow.content_json,
      contentHtml: materialRow.content_html,
    },
    enrollment: toContext(row),
  };
}

/**
 * Materi terbuka bila `sequence_index <= max_sequence_reached` (§4.5).
 * `max_sequence_reached` TIDAK PERNAH turun, sehingga menekan Previous tidak
 * mengunci ulang materi yang sudah dilewati.
 */
export function isMaterialLocked(
  material: Pick<MaterialContext, 'sequenceIndex'>,
  enrollment: Pick<EnrollmentContext, 'maxSequenceReached'>,
): boolean {
  return material.sequenceIndex > enrollment.maxSequenceReached;
}

export function assertMaterialUnlocked(
  material: Pick<MaterialContext, 'sequenceIndex'>,
  enrollment: Pick<EnrollmentContext, 'maxSequenceReached'>,
): void {
  if (isMaterialLocked(material, enrollment)) throw new AppError('MATERIAL_LOCKED');
}

/**
 * Setelah Finish, seluruh event menjadi read-only (§4.5): `POST /responses` dan
 * `POST /complete` ditolak `403 ENROLLMENT_COMPLETED`.
 */
export function assertEnrollmentInProgress(enrollment: EnrollmentContext): void {
  if (enrollment.status !== 'in_progress') {
    throw new AppError('ENROLLMENT_COMPLETED', {
      completedAt: enrollment.completedAt?.toISOString() ?? null,
    });
  }
}
