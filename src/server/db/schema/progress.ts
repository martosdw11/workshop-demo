import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { enrollments } from './enrollments';
import { progressStatusEnum } from './enums';
import { materials } from './materials';

/**
 * `material_progress` — TDD §2.6. Catatan penyelesaian per materi per peserta.
 *
 * `UNIQUE (enrollment_id, material_id)` menjamin poin sebuah materi hanya bisa
 * diraih SEKALI — sekaligus jaminan idempotensi endpoint `complete` (TDD §4.4):
 * pemanggilan kedua kena `ON CONFLICT DO NOTHING` dan poin tidak dobel.
 */
export const materialProgress = pgTable(
  'material_progress',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    enrollmentId: bigint('enrollment_id', { mode: 'number' })
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    materialId: bigint('material_id', { mode: 'number' })
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    /** Baris hanya dibuat saat materi diselesaikan. */
    status: progressStatusEnum('status').notNull().default('completed'),
    /** Hasil scoring engine — all-or-nothing (TDD §4.1). */
    pointsEarned: integer('points_earned').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index #9 — poin sekali per materi (WAJIB, PRD §7.2)
    uniqueIndex('material_progress_enrollment_material_key').on(t.enrollmentId, t.materialId),
    // Index #10 — completed_count per materi untuk drill-down pipeline
    index('material_progress_material_idx').on(t.materialId),
    check('material_progress_points_non_negative', sql`${t.pointsEarned} >= 0`),
  ],
);

export type MaterialProgress = typeof materialProgress.$inferSelect;
export type NewMaterialProgress = typeof materialProgress.$inferInsert;
