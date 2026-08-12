import { sql } from 'drizzle-orm';
import { check, integer, pgTable, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * `rate_limits` — TDD §2.9. Pengganti counter Redis.
 *
 * Implementasi FIXED WINDOW (bukan sliding): satu `INSERT ... ON CONFLICT DO UPDATE`
 * yang me-reset `count` bila `window_start` sudah lewat. Presisinya lebih longgar
 * daripada sliding window, dan itu memang cukup — fungsinya meredam spam &
 * double-submit, bukan menegakkan kuota berbayar.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    /** mis. `response`, `login`, `register`, `enroll`, `write_global`. */
    scope: varchar('scope', { length: 40 }).notNull(),
    /** `userId`, `email`, atau IP sesuai TDD §9.3. */
    identifier: varchar('identifier', { length: 160 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    // Target `ON CONFLICT` untuk upsert increment
    primaryKey({ name: 'rate_limits_pkey', columns: [t.scope, t.identifier] }),
    check('rate_limits_count_non_negative', sql`${t.count} >= 0`),
  ],
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
