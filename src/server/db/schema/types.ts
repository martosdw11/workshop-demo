import { customType } from 'drizzle-orm/pg-core';

/**
 * `citext` — email case-insensitive (TDD §2.2), agar `A@x.com` = `a@x.com`
 * ditegakkan oleh UNIQUE constraint, bukan oleh normalisasi di aplikasi saja.
 * Extension-nya dibuat di migrasi `0000_*.sql` (`CREATE EXTENSION IF NOT EXISTS citext`).
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

/** Kolom waktu selalu `timestamptz`, disimpan UTC (asumsi A-07 TDD). */
export const timestamptzOptions = { withTimezone: true, mode: 'date' } as const;
