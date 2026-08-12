import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * `sessions` — TDD §2.8. Pengganti session store Redis.
 * Satu baris = satu sesi login aktif. Yang disimpan adalah SHA-256 dari token
 * cookie, bukan tokennya — dump database tidak langsung berarti sesi bisa dibajak.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    /** SHA-256 hex dari token cookie opaque 256-bit. */
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Sliding: diperpanjang bila sisa umur < 50% (TDD §5.1). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /**
     * Umur asli sesi ini dalam detik — 28800 (8 jam) atau 2592000 ("Remember me").
     * Ditambahkan migrasi 0001 (asumsi A-B03): sliding refresh perlu tahu
     * "sisa < 50% dari berapa" dan "diperpanjang sebanyak apa", dan angka itu
     * tidak bisa diturunkan dengan andal dari `expires_at - created_at`.
     */
    ttlSeconds: integer('ttl_seconds').notNull().default(28_800),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Ditulis paling sering sekali per 5 menit per sesi, bukan tiap request. */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: varchar('user_agent', { length: 255 }),
  },
  (t) => [
    // Index #16 — query TERPANAS di aplikasi (lookup sesi tiap request)
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    // Index #17 — revoke seluruh sesi user saat akun dinonaktifkan / password direset
    index('sessions_user_id_idx').on(t.userId),
    check('sessions_ttl_seconds_positive', sql`${t.ttlSeconds} > 0`),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
