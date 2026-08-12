import { sql } from 'drizzle-orm';

import type { CreateResponseInput, ResponseListQuery } from '@/lib/validation/response';

import type { SessionUser } from '../auth/session';
import { db } from '../db/client';
import type { IssueStatus, ResponseType } from '../db/schema/enums';
import { decodeCursor, sliceWithCursor, timeCursorSchema } from '../http/pagination';
import {
  assertEnrollmentInProgress,
  assertMaterialUnlocked,
  requireOwnEnrollmentForMaterial,
} from './player.access';

/**
 * Respons peserta — TDD §3.3, §3.5 (EPIC 5 story 5.2).
 *
 * Endpoint POST di sini SENGAJA TIDAK IDEMPOTEN (§4.4): peserta memang boleh
 * mengirim respons berulang tanpa batas pada materi yang sama (PRD §3.A.4).
 * Double-submit diredam di UI (tombol disabled saat pending) + rate limit
 * 10/menit, bukan oleh constraint database.
 *
 * Respons bersifat IMMUTABLE: tidak ada endpoint edit/hapus di kontrak §3.
 */

export type ResponseItem = {
  id: number;
  materialId: number;
  enrollmentId: number;
  type: ResponseType;
  content: string;
  issueStatus: IssueStatus | null;
  createdAt: string;
  author: { id: number; name: string; initials: string };
};

type ResponseRow = {
  id: number;
  material_id: number;
  enrollment_id: number;
  type: ResponseType;
  content: string;
  issue_status: IssueStatus | null;
  created_at: Date;
  author_id: number;
  author_name: string;
};

/** Avatar peserta memakai inisial (§6.6 `ResponseItem`). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

function toItem(row: ResponseRow): ResponseItem {
  return {
    id: row.id,
    materialId: row.material_id,
    enrollmentId: row.enrollment_id,
    type: row.type,
    content: row.content,
    issueStatus: row.issue_status,
    createdAt: new Date(row.created_at).toISOString(),
    author: {
      id: row.author_id,
      name: row.author_name,
      initials: initialsOf(row.author_name),
    },
  };
}

/**
 * `GET /materials/:materialId/responses` — cursor 20 item (§3.3).
 *
 * ASUMSI EKSPLISIT (A-B08): timeline menampilkan respons SELURUH peserta pada
 * materi tersebut, bukan hanya milik pemanggil. Dasarnya index #11
 * `(material_id, type, created_at DESC)` yang sengaja TIDAK memuat
 * `enrollment_id` — index per-peserta (#12) dicadangkan untuk layar admin — dan
 * penamaan panelnya di PRD §3.A.4: "Discussion & Responses".
 *
 * Berjalan sebagai keyset `(created_at DESC, id DESC)` supaya sort+limit 20
 * dilayani langsung oleh index, tanpa sort node.
 */
export async function listResponses(
  materialId: number,
  user: SessionUser,
  query: ResponseListQuery,
): Promise<{ items: ResponseItem[]; nextCursor: string | null }> {
  // Kepemilikan tetap diperiksa: hanya peserta event ini yang boleh membaca.
  await requireOwnEnrollmentForMaterial(materialId, user);

  const cursor = decodeCursor(query.cursor, timeCursorSchema);

  const rows = (await db.execute<ResponseRow>(sql`
    SELECT r.id, r.material_id, r.enrollment_id, r.type, r.content, r.issue_status,
           r.created_at, u.id AS author_id, u.name AS author_name
      FROM responses r
      JOIN users u ON u.id = r.user_id
     WHERE r.material_id = ${materialId}
       AND (${query.type ?? null}::text IS NULL OR r.type = ${query.type ?? null}::response_type)
       AND (
         ${cursor?.at ?? null}::timestamptz IS NULL
         OR (r.created_at, r.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::bigint)
       )
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ${query.limit + 1}
  `)) as unknown as ResponseRow[];

  const page = sliceWithCursor(rows, query.limit, (row) => ({
    at: new Date(row.created_at).toISOString(),
    id: row.id,
  }));

  return { items: page.items.map(toItem), nextCursor: page.nextCursor };
}

export type CreateResponseResult = {
  response: ResponseItem;
  /** Materi sudah memenuhi syarat poin (§4.1) — dipakai UI menandai badge poin. */
  materialWillEarnPoints: boolean;
};

export async function createResponse(
  materialId: number,
  user: SessionUser,
  input: CreateResponseInput,
): Promise<CreateResponseResult> {
  const { material, enrollment } = await requireOwnEnrollmentForMaterial(materialId, user);

  // Urutan guard mengikuti kontrak §3.3: `ENROLLMENT_COMPLETED` lebih dulu,
  // karena event yang sudah di-finish read-only seluruhnya (§4.5).
  assertEnrollmentInProgress(enrollment);
  assertMaterialUnlocked(material, enrollment);

  // `issue_status` terisi jika dan hanya jika `type = 'issue'` — ditegakkan
  // CHECK di database (§2.7); nilai awalnya selalu `open`.
  const issueStatus = input.type === 'issue' ? 'open' : null;

  const inserted = (await db.execute<ResponseRow>(sql`
    WITH baru AS (
      INSERT INTO responses (enrollment_id, material_id, user_id, type, content, issue_status)
      VALUES (${enrollment.enrollmentId}, ${materialId}, ${user.id},
              ${input.type}::response_type, ${input.content}, ${issueStatus}::issue_status)
      RETURNING id, material_id, enrollment_id, type, content, issue_status, created_at, user_id
    )
    SELECT b.id, b.material_id, b.enrollment_id, b.type, b.content, b.issue_status, b.created_at,
           u.id AS author_id, u.name AS author_name
      FROM baru b JOIN users u ON u.id = b.user_id
  `)) as unknown as ResponseRow[];

  // Cek eksistensi `answer` lewat index #13 (index-only scan) — aturan yang sama
  // persis dengan yang dipakai scoring engine (§4.3).
  const answerRows = (await db.execute<{ ada: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM responses
       WHERE enrollment_id = ${enrollment.enrollmentId}
         AND material_id = ${materialId}
         AND type = 'answer'
    ) AS ada
  `)) as unknown as { ada: boolean }[];

  return {
    response: toItem(inserted[0]),
    materialWillEarnPoints: Boolean(answerRows[0]?.ada),
  };
}
