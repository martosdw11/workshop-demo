import 'dotenv/config';

import { sql } from 'drizzle-orm';

import { db } from '@/server/db/client';

/**
 * Helper database untuk lapisan E2E — membungkus fixture Vitest yang sudah ada
 * (tests/helpers/fixtures.ts) supaya kontrak penandanya SATU: email
 * `@test.local` dan judul event berprefiks `[TEST]`.
 */

export {
  TEST_EMAIL_DOMAIN,
  TEST_EVENT_PREFIX,
  cleanupTestData,
  createTestEvent,
  createTestUser,
} from '../../helpers/fixtures';
export { closeDb } from '@/server/db/client';

/** Password yang dipakai `createTestUser` (hardcode di fixtures.ts). */
export const TEST_PASSWORD = 'rahasia123';

/**
 * Kosongkan SELURUH rate limit — bukan hanya scope `test_%` seperti
 * `cleanupTestData`. Registrasi dibatasi 3/jam/IP dan login gagal juga dihitung
 * per IP, jadi run E2E berulang pasti kandas tanpa ini. Dipanggil global.setup
 * dan tersedia manual lewat `npm run db:clear-rate-limits`.
 */
export async function clearRateLimits(): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits`);
}
