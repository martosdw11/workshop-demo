import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { eventStatusEnum } from './enums';
import { users } from './users';

/** `events` — TDD §2.3. Master event yang dibuat admin. */
export const events = pgTable(
  'events',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    /** URL publik hasil adapter storage (TDD §8.1), bukan path filesystem. */
    coverUrl: text('cover_url'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    /** NULL = tanpa batas peserta. */
    quota: integer('quota'),
    status: eventStatusEnum('status').notNull().default('draft'),
    /** Denormalisasi: dipakai validasi kuota di bawah lock (TDD §4.2) & kartu katalog. */
    enrolledCount: integer('enrolled_count').notNull().default(0),
    materialCount: integer('material_count').notNull().default(0),
    totalPoints: integer('total_points').notNull().default(0),
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index #15 — filter katalog All / Active / Upcoming / Finished
    index('events_status_start_end_idx').on(t.status, t.startAt, t.endAt),
    check('events_schedule_valid', sql`${t.endAt} > ${t.startAt}`),
    check('events_quota_positive', sql`${t.quota} IS NULL OR ${t.quota} > 0`),
    check('events_enrolled_count_non_negative', sql`${t.enrolledCount} >= 0`),
    check('events_material_count_non_negative', sql`${t.materialCount} >= 0`),
    check('events_total_points_non_negative', sql`${t.totalPoints} >= 0`),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
