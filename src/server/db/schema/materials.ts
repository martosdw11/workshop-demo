import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { events } from './events';

/**
 * `materials` — TDD §2.4. Materi & sub-materi (self-reference, MAKSIMAL 2 level).
 *
 * Batas 2 level ditegakkan di DATABASE, bukan hanya guard aplikasi:
 * `CHECK depth IN (0,1)` + trigger `materials_set_depth` (lihat migrasi 0000)
 * yang mengisi `depth = 0` bila `parent_id IS NULL` dan `parent.depth + 1` bila terisi.
 */
export const materials = pgTable(
  'materials',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    eventId: bigint('event_id', { mode: 'number' })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** NULL = materi utama; terisi = sub-materi. */
    parentId: bigint('parent_id', { mode: 'number' }).references((): AnyPgColumn => materials.id, {
      onDelete: 'cascade',
    }),
    /** Diisi otomatis oleh trigger — jangan ditulis manual dari aplikasi. */
    depth: smallint('depth').notNull().default(0),
    title: varchar('title', { length: 200 }).notNull(),
    /** Source of truth TipTap (asumsi A-05 TDD). */
    contentJson: jsonb('content_json'),
    /** Hasil render yang SUDAH tersanitasi server-side (TDD §8.4). */
    contentHtml: text('content_html'),
    points: integer('points').notNull().default(0),
    /** Urutan di dalam parent-nya. */
    orderIndex: integer('order_index').notNull(),
    /**
     * Urutan linier hasil flatten seluruh event (Modul 1 → Lesson 1.1 → 1.2 → Modul 2 …).
     * Kunci performa Learning Player: "materi berikutnya" = satu baris
     * `WHERE event_id=$1 AND sequence_index > $2 ORDER BY sequence_index LIMIT 1`.
     * Di-recompute dalam satu transaksi setiap kurikulum disimpan/di-reorder.
     */
    sequenceIndex: integer('sequence_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index #7 — render sidebar Learning Path (wajib PRD §7.2)
    index('materials_event_parent_order_idx').on(t.eventId, t.parentId, t.orderIndex),
    // Index #8 — lookup Next/Previous O(1) + jaminan urutan linier unik
    uniqueIndex('materials_event_sequence_key').on(t.eventId, t.sequenceIndex),
    check('materials_points_non_negative', sql`${t.points} >= 0`),
    check('materials_depth_max_two_levels', sql`${t.depth} IN (0, 1)`),
    check('materials_order_index_non_negative', sql`${t.orderIndex} >= 0`),
  ],
);

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
