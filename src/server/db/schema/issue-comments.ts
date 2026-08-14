import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { responses } from './responses';
import { users } from './users';

/**
 * `issue_comments` — thread komentar pada respons ISSUE (fitur dukungan issue).
 *
 * Karena issue terlihat lintas peserta, setiap kartu issue punya thread agar
 * diskusi FOKUS pada satu postingan: seluruh peserta event + admin boleh
 * membantu di dalamnya.
 *
 * SENGAJA tabel terpisah, BUKAN self-reference `parent_id` di `responses`:
 * komentar thread bukan "respons" — ia tidak masuk timeline tab, tidak
 * menyentuh scoring (§4.3), dan tidak muncul di agregasi admin per-tipe.
 * Ikut terhapus bersama issue-nya (FK CASCADE).
 *
 * Pola konten sama dengan `responses`: `content` plain text hasil ekstraksi
 * (CHECK panjang), `content_html` hasil sanitasi server (§8.4), `edited_at`
 * penanda "(diedit)".
 */
export const issueComments = pgTable(
  'issue_comments',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    responseId: bigint('response_id', { mode: 'number' })
      .notNull()
      .references(() => responses.id, { onDelete: 'cascade' }),
    /** Penulis komentar: peserta event ATAU admin. */
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contentHtml: text('content_html'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (t) => [
    // Thread dibaca kronologis per issue.
    index('issue_comments_response_created_idx').on(t.responseId, t.createdAt),
    check('issue_comments_content_length', sql`length(btrim(${t.content})) BETWEEN 1 AND 5000`),
  ],
);

export type IssueComment = typeof issueComments.$inferSelect;
export type NewIssueComment = typeof issueComments.$inferInsert;
