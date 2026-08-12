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

import { enrollmentStatusEnum } from './enums';
import { events } from './events';
import { materials } from './materials';
import { users } from './users';

/**
 * `enrollments` — TDD §2.5. Record keikutsertaan peserta pada sebuah event.
 *
 * ATURAN INTI: `UNIQUE (event_id, user_id)` — satu event hanya bisa diikuti
 * SEKALI oleh peserta yang sama. Ini penjaga sesungguhnya (bersama
 * `ON CONFLICT DO NOTHING`), bukan validasi UI (PRD §2, TDD §4.2).
 */
export const enrollments = pgTable(
  'enrollments',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    eventId: bigint('event_id', { mode: 'number' })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull().default('in_progress'),
    /** Posisi terakhir peserta — dipakai fitur Resume & drill-down monitoring admin. */
    currentMaterialId: bigint('current_material_id', { mode: 'number' }).references(
      () => materials.id,
      { onDelete: 'set null' },
    ),
    /** Batas unlock: materi dengan `sequence_index <= nilai ini` boleh dibuka. Tidak pernah turun. */
    maxSequenceReached: integer('max_sequence_reached').notNull().default(0),
    /** Untuk progress bar tanpa `COUNT`. */
    completedMaterialCount: integer('completed_material_count').notNull().default(0),
    totalPoints: integer('total_points').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    /** Dasar klasifikasi segmen "Stalled" pada Event Pipeline (TDD §7.5). */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    // Index #3 — 1 event 1x per peserta (WAJIB, PRD §7.2)
    uniqueIndex('enrollments_event_user_key').on(t.eventId, t.userId),
    // Index #4 — Dashboard & Achievement History peserta
    index('enrollments_user_joined_idx').on(t.userId, t.joinedAt.desc()),
    // Index #5 — Pipeline Summary per event
    index('enrollments_event_status_idx').on(t.eventId, t.status),
    // Index #6 — drill-down "berapa peserta di tiap materi" (pengganti tabel agregat)
    index('enrollments_event_current_material_idx').on(t.eventId, t.currentMaterialId),
    check('enrollments_total_points_non_negative', sql`${t.totalPoints} >= 0`),
    check('enrollments_max_sequence_non_negative', sql`${t.maxSequenceReached} >= 0`),
    check('enrollments_completed_count_non_negative', sql`${t.completedMaterialCount} >= 0`),
    // Konsistensi state machine: completed_at terisi jika dan hanya jika status = 'completed'
    check(
      'enrollments_completed_at_consistency',
      sql`(${t.status} = 'completed') = (${t.completedAt} IS NOT NULL)`,
    ),
  ],
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
