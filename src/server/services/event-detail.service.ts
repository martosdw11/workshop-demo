import { sql } from 'drizzle-orm';

import type { AdminResponseQuery } from '@/lib/validation/response';
import type { EventParticipantQuery } from '@/lib/validation/user';

import { db } from '../db/client';
import type { EnrollmentStatus, IssueStatus, ResponseType } from '../db/schema/enums';
import { AppError } from '../http/errors';
import { decodeCursor, idCursorSchema, sliceWithCursor, timeCursorSchema } from '../http/pagination';
import { progressPercent } from './catalog.service';
import { initialsOf } from './response.service';

/**
 * Detail event admin — TDD §3.4 (EPIC 7 story 7.1):
 * tab "Peserta & Nilai" (matriks peserta × materi) dan tab "Respons".
 */

async function assertEventExists(eventId: number): Promise<void> {
  const rows = (await db.execute<{ ada: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM events WHERE id = ${eventId}) AS ada
  `)) as unknown as { ada: boolean }[];
  if (!rows[0]?.ada) throw new AppError('EVENT_NOT_FOUND');
}

export type MatrixMaterial = {
  id: number;
  title: string;
  depth: number;
  sequenceIndex: number;
  points: number;
};

export type MatrixParticipant = {
  user: { id: number; name: string; email: string; initials: string };
  enrollmentId: number;
  status: EnrollmentStatus;
  currentMaterial: { id: number; title: string } | null;
  totalPoints: number;
  progressPercent: number;
  lastActivityAt: string;
  perMaterial: { materialId: number; pointsEarned: number | null; completed: boolean }[];
};

/**
 * `GET /admin/events/:id/participants` — §3.4.
 * Matriks peserta × materi, dipaginasi 25 peserta per halaman (§6.9): 25 × 20
 * materi = 500 sel, jauh di bawah ambang yang membebani browser — yang wajib
 * dijaga hanyalah paginasinya.
 */
export async function getEventParticipants(
  eventId: number,
  query: EventParticipantQuery,
): Promise<{ items: MatrixParticipant[]; materials: MatrixMaterial[]; nextCursor: string | null }> {
  await assertEventExists(eventId);

  const materials = (await db.execute<{
    id: number;
    title: string;
    depth: number;
    sequence_index: number;
    points: number;
  }>(sql`
    SELECT id, title, depth, sequence_index, points
      FROM materials WHERE event_id = ${eventId} ORDER BY sequence_index
  `)) as unknown as {
    id: number;
    title: string;
    depth: number;
    sequence_index: number;
    points: number;
  }[];

  const cursor = decodeCursor(query.cursor, idCursorSchema);

  const rows = (await db.execute<{
    enrollment_id: number;
    user_id: number;
    name: string;
    email: string;
    status: EnrollmentStatus;
    total_points: number;
    completed_material_count: number;
    current_material_id: number | null;
    current_material_title: string | null;
    last_activity_at: Date;
  }>(sql`
    SELECT en.id AS enrollment_id, u.id AS user_id, u.name, u.email, en.status,
           en.total_points, en.completed_material_count,
           en.current_material_id, m.title AS current_material_title, en.last_activity_at
      FROM enrollments en
      JOIN users u ON u.id = en.user_id
      LEFT JOIN materials m ON m.id = en.current_material_id
     WHERE en.event_id = ${eventId}
       AND (${query.status === 'all' ? null : query.status}::text IS NULL
            OR en.status = ${query.status === 'all' ? null : query.status}::enrollment_status)
       AND (${query.q ?? null}::text IS NULL
            OR u.name ILIKE '%' || ${query.q ?? null}::text || '%'
            OR u.email::text ILIKE '%' || ${query.q ?? null}::text || '%')
       AND (${cursor?.id ?? null}::bigint IS NULL OR en.id > ${cursor?.id ?? null}::bigint)
     ORDER BY en.id
     LIMIT ${query.limit + 1}
  `)) as unknown as {
    enrollment_id: number;
    user_id: number;
    name: string;
    email: string;
    status: EnrollmentStatus;
    total_points: number;
    completed_material_count: number;
    current_material_id: number | null;
    current_material_title: string | null;
    last_activity_at: Date;
  }[];

  const page = sliceWithCursor(rows, query.limit, (row) => ({ id: row.enrollment_id }));

  // Satu query progres untuk SELURUH halaman, bukan satu query per peserta —
  // 25 peserta × 20 materi tetap dua round-trip, bukan 26.
  const enrollmentIds = page.items.map((row) => row.enrollment_id);
  const progressByEnrollment = new Map<number, Map<number, number>>();

  if (enrollmentIds.length > 0) {
    const list = sql.join(
      enrollmentIds.map((id) => sql`${id}::bigint`),
      sql`, `,
    );
    const progressRows = (await db.execute<{
      enrollment_id: number;
      material_id: number;
      points_earned: number;
    }>(sql`
      SELECT enrollment_id, material_id, points_earned
        FROM material_progress WHERE enrollment_id IN (${list})
    `)) as unknown as {
      enrollment_id: number;
      material_id: number;
      points_earned: number;
    }[];

    for (const row of progressRows) {
      const bucket = progressByEnrollment.get(row.enrollment_id) ?? new Map<number, number>();
      bucket.set(row.material_id, row.points_earned);
      progressByEnrollment.set(row.enrollment_id, bucket);
    }
  }

  return {
    materials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      depth: m.depth,
      sequenceIndex: m.sequence_index,
      points: m.points,
    })),
    items: page.items.map((row) => {
      const earned = progressByEnrollment.get(row.enrollment_id);
      return {
        user: {
          id: row.user_id,
          name: row.name,
          email: row.email,
          initials: initialsOf(row.name),
        },
        enrollmentId: row.enrollment_id,
        status: row.status,
        currentMaterial: row.current_material_id
          ? { id: row.current_material_id, title: row.current_material_title ?? '' }
          : null,
        totalPoints: row.total_points,
        progressPercent: progressPercent(row.completed_material_count, materials.length),
        lastActivityAt: new Date(row.last_activity_at).toISOString(),
        perMaterial: materials.map((m) => ({
          materialId: m.id,
          pointsEarned: earned?.get(m.id) ?? null,
          completed: earned?.has(m.id) ?? false,
        })),
      };
    }),
    nextCursor: page.nextCursor,
  };
}

export type AdminResponseItem = {
  id: number;
  type: ResponseType;
  content: string;
  /** HTML tersanitasi dari rich editor respons; `null` untuk respons lama. */
  contentHtml: string | null;
  /** Jumlah komentar thread — hanya bermakna untuk `type = 'issue'`. */
  commentCount: number;
  issueStatus: IssueStatus | null;
  createdAt: string;
  material: { id: number; title: string; depth: number };
  user: { id: number; name: string; email: string; initials: string };
};

/** `GET /admin/events/:id/responses` — §3.4, filter tipe/materi/issueStatus. */
export async function getEventResponses(
  eventId: number,
  query: AdminResponseQuery,
): Promise<{ items: AdminResponseItem[]; nextCursor: string | null }> {
  await assertEventExists(eventId);

  const cursor = decodeCursor(query.cursor, timeCursorSchema);

  const rows = (await db.execute<{
    id: number;
    type: ResponseType;
    content: string;
    content_html: string | null;
    comment_count?: number;
    issue_status: IssueStatus | null;
    created_at: Date;
    material_id: number;
    material_title: string;
    depth: number;
    user_id: number;
    name: string;
    email: string;
  }>(sql`
    SELECT r.id, r.type, r.content, r.content_html, r.issue_status, r.created_at,
           (SELECT count(*) FROM issue_comments c WHERE c.response_id = r.id) AS comment_count,
           m.id AS material_id, m.title AS material_title, m.depth,
           u.id AS user_id, u.name, u.email
      FROM responses r
      JOIN materials m ON m.id = r.material_id
      JOIN users u ON u.id = r.user_id
     WHERE m.event_id = ${eventId}
       AND (${query.type ?? null}::text IS NULL
            OR r.type = ${query.type ?? null}::response_type)
       AND (${query.materialId ?? null}::bigint IS NULL
            OR r.material_id = ${query.materialId ?? null}::bigint)
       AND (${query.issueStatus ?? null}::text IS NULL
            OR r.issue_status = ${query.issueStatus ?? null}::issue_status)
       AND (
         ${cursor?.at ?? null}::timestamptz IS NULL
         OR (r.created_at, r.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::bigint)
       )
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ${query.limit + 1}
  `)) as unknown as {
    id: number;
    type: ResponseType;
    content: string;
    content_html: string | null;
    comment_count?: number;
    issue_status: IssueStatus | null;
    created_at: Date;
    material_id: number;
    material_title: string;
    depth: number;
    user_id: number;
    name: string;
    email: string;
  }[];

  const page = sliceWithCursor(rows, query.limit, (row) => ({
    at: new Date(row.created_at).toISOString(),
    id: row.id,
  }));

  return {
    items: page.items.map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      contentHtml: row.content_html,
      commentCount: Number(row.comment_count ?? 0),
      issueStatus: row.issue_status,
      createdAt: new Date(row.created_at).toISOString(),
      material: { id: row.material_id, title: row.material_title, depth: row.depth },
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        initials: initialsOf(row.name),
      },
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * `PATCH /admin/responses/:id/issue-status` — §3.4. `422 NOT_AN_ISSUE`.
 */
export async function updateIssueStatus(
  responseId: number,
  issueStatus: IssueStatus,
): Promise<AdminResponseItem> {
  const currentRows = (await db.execute<{ type: ResponseType }>(sql`
    SELECT type FROM responses WHERE id = ${responseId}
  `)) as unknown as { type: ResponseType }[];

  const current = currentRows[0];
  if (!current) throw new AppError('NOT_FOUND');
  if (current.type !== 'issue') throw new AppError('NOT_AN_ISSUE', { type: current.type });

  const rows = (await db.execute<{
    id: number;
    type: ResponseType;
    content: string;
    content_html: string | null;
    comment_count?: number;
    issue_status: IssueStatus | null;
    created_at: Date;
    material_id: number;
    material_title: string;
    depth: number;
    user_id: number;
    name: string;
    email: string;
  }>(sql`
    WITH diperbarui AS (
      UPDATE responses SET issue_status = ${issueStatus}::issue_status
       WHERE id = ${responseId} AND type = 'issue'
      RETURNING id, type, content, content_html, issue_status, created_at, material_id, user_id
    )
    SELECT d.id, d.type, d.content, d.content_html, d.issue_status, d.created_at,
           (SELECT count(*) FROM issue_comments c WHERE c.response_id = d.id) AS comment_count,
           m.id AS material_id, m.title AS material_title, m.depth,
           u.id AS user_id, u.name, u.email
      FROM diperbarui d
      JOIN materials m ON m.id = d.material_id
      JOIN users u ON u.id = d.user_id
  `)) as unknown as {
    id: number;
    type: ResponseType;
    content: string;
    content_html: string | null;
    comment_count?: number;
    issue_status: IssueStatus | null;
    created_at: Date;
    material_id: number;
    material_title: string;
    depth: number;
    user_id: number;
    name: string;
    email: string;
  }[];

  const row = rows[0];
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    contentHtml: row.content_html,
    commentCount: Number(row.comment_count ?? 0),
    issueStatus: row.issue_status,
    createdAt: new Date(row.created_at).toISOString(),
    material: { id: row.material_id, title: row.material_title, depth: row.depth },
    user: { id: row.user_id, name: row.name, email: row.email, initials: initialsOf(row.name) },
  };
}

/**
 * `DELETE /admin/responses/:id` — admin all-access: boleh menghapus respons
 * APA PUN, termasuk milik peserta lain dan tipe apa pun (moderasi).
 *
 * CATATAN scoring: menghapus `answer` TIDAK menarik kembali poin yang sudah
 * diberikan — poin bersifat all-or-nothing dan dicatat di `material_progress`
 * saat complete (§4.1); penghapusan hanya memengaruhi kelayakan complete
 * BERIKUTNYA pada materi itu.
 */
export async function adminDeleteResponse(responseId: number): Promise<void> {
  const rows = (await db.execute<{ id: number }>(sql`
    DELETE FROM responses WHERE id = ${responseId} RETURNING id
  `)) as unknown as { id: number }[];
  if (!rows[0]) throw new AppError('NOT_FOUND');
}
