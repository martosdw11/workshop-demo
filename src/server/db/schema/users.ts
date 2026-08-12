import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { userRoleEnum, userStatusEnum } from './enums';
import { citext } from './types';

/** `users` — TDD §2.2. Akun peserta & admin. */
export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    /** Identitas login. `citext` → unik tanpa peduli besar-kecil huruf. */
    email: citext('email').notNull(),
    /** E.164 hasil normalisasi (asumsi A-12 TDD), mis. `+628123456789`. */
    phone: varchar('phone', { length: 20 }).notNull(),
    /** Argon2id — TIDAK PERNAH plaintext (PRD §7.8). */
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('participant'),
    status: userStatusEnum('status').notNull().default('active'),
    /**
     * Denormalisasi akumulasi poin lintas event untuk badge Total Points di navbar.
     * Di-update pada transaksi yang sama dengan scoring (TDD §4.3).
     */
    totalPoints: integer('total_points').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Index #1 — satu email satu akun (PRD §6)
    uniqueIndex('users_email_key').on(t.email),
    // Index #2 — filter Participant List & User Access
    index('users_role_status_idx').on(t.role, t.status),
    check('users_total_points_non_negative', sql`${t.totalPoints} >= 0`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
