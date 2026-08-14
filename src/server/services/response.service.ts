import { sql } from 'drizzle-orm';

import { renderResponseContent } from '@/lib/sanitize-html';
import { responseContentSchema } from '@/lib/validation/response';
import type {
  CreateResponseInput,
  ResponseListQuery,
  UpdateResponseInput,
} from '@/lib/validation/response';

import type { SessionUser } from '../auth/session';
import { db } from '../db/client';
import { env } from '../env';
import type { IssueStatus, ResponseType } from '../db/schema/enums';
import { AppError } from '../http/errors';
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
 * REVISI: respons TIDAK lagi immutable. Penulis boleh meng-edit dan menghapus
 * respons miliknya sendiri — semua tipe: jawaban, komentar, issue
 * (`updateOwnResponse` / `deleteOwnResponse`); admin boleh menghapus respons
 * apa pun (`adminDeleteResponse` di event-detail.service).
 *
 * CATATAN scoring: menghapus `answer` TIDAK menarik kembali poin yang sudah
 * diberikan (all-or-nothing, dicatat di `material_progress` saat complete,
 * §4.1) — penghapusan hanya memengaruhi kelayakan complete BERIKUTNYA.
 */

export type ResponseItem = {
  id: number;
  materialId: number;
  enrollmentId: number;
  type: ResponseType;
  content: string;
  /** HTML tersanitasi dari rich editor; `null` untuk respons lama plain-text. */
  contentHtml: string | null;
  issueStatus: IssueStatus | null;
  createdAt: string;
  /** Terisi bila penulis pernah meng-edit respons ini. */
  editedAt: string | null;
  author: { id: number; name: string; initials: string };
};

type ResponseRow = {
  id: number;
  material_id: number;
  enrollment_id: number;
  type: ResponseType;
  content: string;
  content_html: string | null;
  issue_status: IssueStatus | null;
  created_at: Date;
  edited_at: Date | null;
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
    contentHtml: row.content_html,
    issueStatus: row.issue_status,
    createdAt: new Date(row.created_at).toISOString(),
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
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
 * REVISI A-B08: timeline `answer`/`comment` HANYA menampilkan respons milik
 * pemanggil sendiri (`user_id = user.id`); `issue` sengaja TETAP terlihat oleh
 * seluruh peserta materi tersebut — kendala biasanya dialami bersama, dan
 * melihat issue orang lain mencegah laporan duplikat. Endpoint ini
 * participant-only (`requireParticipant` di route); admin melihat SEMUA respons
 * lewat layar admin sendiri (`/admin/events/:id/responses` dan detail peserta).
 *
 * Berjalan sebagai keyset `(created_at DESC, id DESC)`; filter kepemilikan
 * menyaring hasil index #11 `(material_id, type, created_at DESC)`.
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
    SELECT r.id, r.material_id, r.enrollment_id, r.type, r.content, r.content_html,
           r.issue_status, r.created_at, r.edited_at, u.id AS author_id, u.name AS author_name
      FROM responses r
      JOIN users u ON u.id = r.user_id
     WHERE r.material_id = ${materialId}
       AND (r.type = 'issue' OR r.user_id = ${user.id})
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

/**
 * Jalur rich editor: `contentJson` di-PRUNE → RENDER → SANITIZE di server
 * (§8.4). Plain text hasil ekstraksi tetap wajib lolos aturan panjang 1–5000
 * — dokumen yang hanya berisi node kosong ditolak di sini, bukan oleh CHECK.
 * Jalur kompatibilitas: klien lama mengirim `content` plain text; schema
 * menjamin salah satu dari keduanya pasti ada.
 */
function deriveContent(input: { content?: string; contentJson?: unknown | null }): {
  content: string;
  contentHtml: string | null;
} {
  if (input.contentJson !== null && input.contentJson !== undefined) {
    const rendered = renderResponseContent(input.contentJson, {
      mediaPublicHost: env.MEDIA_PUBLIC_HOST,
    });
    const parsed = responseContentSchema.safeParse(rendered.text);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        undefined,
        parsed.error.issues[0]?.message ?? 'Respons tidak valid.',
      );
    }
    return { content: parsed.data, contentHtml: rendered.html };
  }
  return { content: input.content as string, contentHtml: null };
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

  const { content, contentHtml } = deriveContent(input);

  const inserted = (await db.execute<ResponseRow>(sql`
    WITH baru AS (
      INSERT INTO responses (enrollment_id, material_id, user_id, type, content, content_html, issue_status)
      VALUES (${enrollment.enrollmentId}, ${materialId}, ${user.id},
              ${input.type}::response_type, ${content}, ${contentHtml}, ${issueStatus}::issue_status)
      RETURNING id, material_id, enrollment_id, type, content, content_html, issue_status, created_at, edited_at, user_id
    )
    SELECT b.id, b.material_id, b.enrollment_id, b.type, b.content, b.content_html, b.issue_status, b.created_at,
           b.edited_at, u.id AS author_id, u.name AS author_name
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

/**
 * Guard bersama edit/hapus milik-sendiri:
 *  - respons harus ada (`404 NOT_FOUND`),
 *  - milik pemanggil (`403 FORBIDDEN`) — fitur hanya berlaku untuk pesan yang
 *    dibuat user login sendiri; hapus lintas-pemilik hanya untuk admin
 *    (`adminDeleteResponse`, event-detail.service),
 *  - enrollment masih `in_progress` (`403 ENROLLMENT_COMPLETED`, §4.5).
 */
async function requireOwnResponse(
  responseId: number,
  user: SessionUser,
): Promise<void> {
  const rows = (await db.execute<{
    user_id: number;
    enrollment_status: 'in_progress' | 'completed';
  }>(sql`
    SELECT r.user_id, e.status AS enrollment_status
      FROM responses r
      JOIN enrollments e ON e.id = r.enrollment_id
     WHERE r.id = ${responseId}
  `)) as unknown as { user_id: number; enrollment_status: string }[];

  const row = rows[0];
  if (!row) throw new AppError('NOT_FOUND');
  if (row.user_id !== user.id) throw new AppError('FORBIDDEN');
  if (row.enrollment_status !== 'in_progress') throw new AppError('ENROLLMENT_COMPLETED');
}

/** `PATCH /responses/:id` — penulis memperbaiki responsnya sendiri (semua tipe). */
export async function updateOwnResponse(
  responseId: number,
  user: SessionUser,
  input: UpdateResponseInput,
): Promise<ResponseItem> {
  await requireOwnResponse(responseId, user);
  const { content, contentHtml } = deriveContent(input);

  const rows = (await db.execute<ResponseRow>(sql`
    WITH diubah AS (
      UPDATE responses
         SET content = ${content}, content_html = ${contentHtml}, edited_at = now()
       WHERE id = ${responseId}
      RETURNING id, material_id, enrollment_id, type, content, content_html, issue_status,
                created_at, edited_at, user_id
    )
    SELECT d.id, d.material_id, d.enrollment_id, d.type, d.content, d.content_html,
           d.issue_status, d.created_at, d.edited_at, u.id AS author_id, u.name AS author_name
      FROM diubah d JOIN users u ON u.id = d.user_id
  `)) as unknown as ResponseRow[];

  return toItem(rows[0]);
}

/** `DELETE /responses/:id` — penulis menghapus responsnya sendiri (semua tipe). */
export async function deleteOwnResponse(
  responseId: number,
  user: SessionUser,
): Promise<void> {
  await requireOwnResponse(responseId, user);
  await db.execute(sql`DELETE FROM responses WHERE id = ${responseId}`);
}
