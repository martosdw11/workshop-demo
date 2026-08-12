import { bigint, char, index, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

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
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
