import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { enrollments } from './enrollments';
import { issueStatusEnum, responseTypeEnum } from './enums';
import { materials } from './materials';
import { users } from './users';

/**
 * `responses` — TDD §2.7. Seluruh input peserta, jumlahnya TAK TERBATAS per materi.
 *
 * Sengaja TIDAK ada unique constraint di sini: peserta memang boleh mengirim
 * respons berulang pada materi yang sama (PRD §3.A.4), sehingga endpoint POST
 * respons non-idempoten secara sengaja (TDD §4.4).
 *
 * Penguncian setelah Finish (`ENROLLMENT_COMPLETED`) adalah guard di service layer,
 * bukan constraint — lihat TDD §4.5.
 */
export const responses = pgTable(
  'responses',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    enrollmentId: bigint('enrollment_id', { mode: 'number' })
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    materialId: bigint('material_id', { mode: 'number' })
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    /** Redundan terhadap enrollment, tapi dipakai feed admin tanpa join. */
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: responseTypeEnum('type').notNull(),
    /**
     * Plain text hasil ekstraksi dokumen editor — dipakai snippet admin,
     * CHECK panjang, dan scoring. Kolom ini TIDAK PERNAH dirender sebagai HTML.
     */
    content: text('content').notNull(),
    /**
     * HTML tersanitasi dari rich editor respons (`renderResponseContent`,
     * §8.4 pola yang sama dengan `materials.content_html`). `NULL` untuk
     * respons lama era plain-text — FE jatuh kembali ke `content`.
     */
    contentHtml: text('content_html'),
    /** Hanya bermakna untuk `type = 'issue'`. */
    issueStatus: issueStatusEnum('issue_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index #11 — timeline per tab, sort+limit 20 tanpa sort node
    index('responses_material_type_created_idx').on(t.materialId, t.type, t.createdAt.desc()),
    // Index #12 — detail peserta per event (WAJIB, PRD §7.2)
    index('responses_enrollment_created_idx').on(t.enrollmentId, t.createdAt.desc()),
    // Index #13 — cek eksistensi `answer` di scoring engine (index-only scan)
    index('responses_enrollment_material_type_idx').on(t.enrollmentId, t.materialId, t.type),
    // Index #14 — partial: Recent Activity Feed & daftar issue terbuka
    index('responses_open_issue_idx')
      .on(t.createdAt.desc())
      .where(sql`type = 'issue' AND issue_status = 'open'`),
    check('responses_content_length', sql`length(btrim(${t.content})) BETWEEN 1 AND 5000`),
    // `issue_status` terisi jika dan hanya jika type = 'issue'
    check(
      'responses_issue_status_consistency',
      sql`(${t.type} = 'issue') = (${t.issueStatus} IS NOT NULL)`,
    ),
  ],
);

export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
