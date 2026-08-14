import { sql } from 'drizzle-orm';

import type { UpdateResponseInput } from '@/lib/validation/response';

import type { SessionUser } from '../auth/session';
import { db } from '../db/client';
import { AppError } from '../http/errors';
import { deriveContent, initialsOf } from './response.service';

/**
 * Thread komentar pada respons ISSUE (fitur dukungan issue).
 *
 * Karena issue terlihat lintas peserta, setiap kartu issue punya thread agar
 * diskusi fokus pada satu postingan. Yang boleh membaca & menulis:
 *  - SELURUH peserta ter-enroll pada event pemilik issue (bukan hanya penulis
 *    issue) — inilah cara "user lain membantu issue temannya";
 *  - ADMIN (moderasi + ikut membantu), tanpa perlu enrollment.
 *
 * Aturan mutasi mengikuti pola respons: edit hanya milik sendiri; hapus milik
 * sendiri ATAU admin (all-access). Thread hanya ada di `type = 'issue'`
 * (`422 NOT_AN_ISSUE` untuk tipe lain).
 */

export type IssueCommentItem = {
  id: number;
  responseId: number;
  content: string;
  contentHtml: string | null;
  createdAt: string;
  editedAt: string | null;
  author: { id: number; name: string; initials: string; isAdmin: boolean };
};

type CommentRow = {
  id: number;
  response_id: number;
  content: string;
  content_html: string | null;
  created_at: Date;
  edited_at: Date | null;
  author_id: number;
  author_name: string;
  author_role: 'admin' | 'participant';
};

function toItem(row: CommentRow): IssueCommentItem {
  return {
    id: row.id,
    responseId: row.response_id,
    content: row.content,
    contentHtml: row.content_html,
    createdAt: new Date(row.created_at).toISOString(),
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
    author: {
      id: row.author_id,
      name: row.author_name,
      initials: initialsOf(row.author_name),
      isAdmin: row.author_role === 'admin',
    },
  };
}

/**
 * Otorisasi akses thread: issue harus ada dan bertipe `issue`; admin selalu
 * boleh; peserta harus punya enrollment pada event pemilik issue.
 * Mengembalikan status enrollment pemanggil (`null` untuk admin) — dipakai
 * `createIssueComment` menegakkan read-only §4.5.
 */
async function authorizeThreadAccess(
  responseId: number,
  user: SessionUser,
): Promise<{ enrollmentStatus: 'in_progress' | 'completed' | null }> {
  const rows = (await db.execute<{ type: string; event_id: number }>(sql`
    SELECT r.type, m.event_id
      FROM responses r JOIN materials m ON m.id = r.material_id
     WHERE r.id = ${responseId}
  `)) as unknown as { type: string; event_id: number }[];

  const response = rows[0];
  if (!response) throw new AppError('NOT_FOUND');
  if (response.type !== 'issue') throw new AppError('NOT_AN_ISSUE', { type: response.type });

  if (user.role === 'admin') return { enrollmentStatus: null };

  const enrollmentRows = (await db.execute<{ status: 'in_progress' | 'completed' }>(sql`
    SELECT status FROM enrollments
     WHERE event_id = ${response.event_id} AND user_id = ${user.id}
  `)) as unknown as { status: 'in_progress' | 'completed' }[];

  const enrollment = enrollmentRows[0];
  if (!enrollment) throw new AppError('FORBIDDEN');
  return { enrollmentStatus: enrollment.status };
}

/**
 * `GET /responses/:id/comments` — seluruh thread, kronologis NAIK (percakapan
 * dibaca dari atas). Tanpa cursor: thread per-issue kecil; bila kelak membesar,
 * index `(response_id, created_at)` sudah siap untuk keyset.
 */
export async function listIssueComments(
  responseId: number,
  user: SessionUser,
): Promise<{ items: IssueCommentItem[] }> {
  await authorizeThreadAccess(responseId, user);

  const rows = (await db.execute<CommentRow>(sql`
    SELECT c.id, c.response_id, c.content, c.content_html, c.created_at, c.edited_at,
           u.id AS author_id, u.name AS author_name, u.role AS author_role
      FROM issue_comments c JOIN users u ON u.id = c.user_id
     WHERE c.response_id = ${responseId}
     ORDER BY c.created_at ASC, c.id ASC
  `)) as unknown as CommentRow[];

  return { items: rows.map(toItem) };
}

/** `POST /responses/:id/comments` — peserta event mana pun + admin. */
export async function createIssueComment(
  responseId: number,
  user: SessionUser,
  input: UpdateResponseInput,
): Promise<IssueCommentItem> {
  const { enrollmentStatus } = await authorizeThreadAccess(responseId, user);
  // Read-only §4.5 berlaku per-peserta: yang sudah finish tidak menulis lagi.
  // Admin (`enrollmentStatus === null`) tidak terkena aturan ini.
  if (enrollmentStatus === 'completed') throw new AppError('ENROLLMENT_COMPLETED');

  const { content, contentHtml } = deriveContent(input);

  const rows = (await db.execute<CommentRow>(sql`
    WITH baru AS (
      INSERT INTO issue_comments (response_id, user_id, content, content_html)
      VALUES (${responseId}, ${user.id}, ${content}, ${contentHtml})
      RETURNING id, response_id, content, content_html, created_at, edited_at, user_id
    )
    SELECT b.id, b.response_id, b.content, b.content_html, b.created_at, b.edited_at,
           u.id AS author_id, u.name AS author_name, u.role AS author_role
      FROM baru b JOIN users u ON u.id = b.user_id
  `)) as unknown as CommentRow[];

  return toItem(rows[0]);
}

/** Guard mutasi komentar: `404` bila tak ada; kepemilikan diperiksa pemanggil. */
async function findCommentOwner(commentId: number): Promise<number> {
  const rows = (await db.execute<{ user_id: number }>(sql`
    SELECT user_id FROM issue_comments WHERE id = ${commentId}
  `)) as unknown as { user_id: number }[];
  if (!rows[0]) throw new AppError('NOT_FOUND');
  return rows[0].user_id;
}

/** `PATCH /issue-comments/:id` — hanya penulis komentar itu sendiri. */
export async function updateOwnIssueComment(
  commentId: number,
  user: SessionUser,
  input: UpdateResponseInput,
): Promise<IssueCommentItem> {
  const ownerId = await findCommentOwner(commentId);
  if (ownerId !== user.id) throw new AppError('FORBIDDEN');

  const { content, contentHtml } = deriveContent(input);

  const rows = (await db.execute<CommentRow>(sql`
    WITH diubah AS (
      UPDATE issue_comments
         SET content = ${content}, content_html = ${contentHtml}, edited_at = now()
       WHERE id = ${commentId}
      RETURNING id, response_id, content, content_html, created_at, edited_at, user_id
    )
    SELECT d.id, d.response_id, d.content, d.content_html, d.created_at, d.edited_at,
           u.id AS author_id, u.name AS author_name, u.role AS author_role
      FROM diubah d JOIN users u ON u.id = d.user_id
  `)) as unknown as CommentRow[];

  return toItem(rows[0]);
}

/** `DELETE /issue-comments/:id` — penulisnya sendiri ATAU admin (all-access). */
export async function deleteIssueComment(commentId: number, user: SessionUser): Promise<void> {
  const ownerId = await findCommentOwner(commentId);
  if (user.role !== 'admin' && ownerId !== user.id) throw new AppError('FORBIDDEN');
  await db.execute(sql`DELETE FROM issue_comments WHERE id = ${commentId}`);
}
