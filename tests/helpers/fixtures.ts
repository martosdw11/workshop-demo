import { sql } from 'drizzle-orm';

import { hashPassword } from '@/server/auth/password';
import type { SessionUser } from '@/server/auth/session';
import { db } from '@/server/db/client';

/**
 * Fixture test integrasi — TDD §11.4.
 *
 * Semua baris yang dibuat test diberi penanda `@test.local` pada email dan
 * prefiks `[TEST]` pada judul event, sehingga pembersihannya bisa presisi dan
 * tidak pernah menyentuh data seed development.
 */

export const TEST_EMAIL_DOMAIN = '@test.local';
export const TEST_EVENT_PREFIX = '[TEST]';

let counter = 0;
const nextSuffix = () => {
  counter += 1;
  return `${process.pid}-${counter}`;
};

export async function createTestUser(
  overrides: { role?: 'participant' | 'admin'; name?: string } = {},
): Promise<SessionUser> {
  const suffix = nextSuffix();
  const passwordHash = await hashPassword('rahasia123');

  const rows = (await db.execute<{
    id: number;
    name: string;
    email: string;
    phone: string;
    role: 'participant' | 'admin';
    status: 'active' | 'inactive';
    total_points: number;
  }>(sql`
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (${overrides.name ?? `Test User ${suffix}`},
            ${`u${suffix.replace(/-/g, '')}${TEST_EMAIL_DOMAIN}`},
            ${`+6281${String(Date.now()).slice(-9)}`},
            ${passwordHash},
            ${overrides.role ?? 'participant'}::user_role)
    RETURNING id, name, email, phone, role, status, total_points
  `)) as unknown as {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: 'participant' | 'admin';
    status: 'active' | 'inactive';
    total_points: number;
  }[];

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    totalPoints: row.total_points,
    sessionId: 0,
  };
}

export type TestEvent = {
  eventId: number;
  materialIds: number[];
  points: number[];
};

/**
 * Membuat event `published` dengan N materi datar (semuanya level 0),
 * `sequence_index` 1..N dan `points` yang bisa ditentukan pemanggil.
 */
export async function createTestEvent(options: {
  adminId: number;
  points?: number[];
  quota?: number | null;
}): Promise<TestEvent> {
  const points = options.points ?? [50, 30, 20];
  const suffix = nextSuffix();

  const eventRows = (await db.execute<{ id: number }>(sql`
    INSERT INTO events (title, start_at, end_at, quota, status, created_by,
                        material_count, total_points, published_at)
    VALUES (${`${TEST_EVENT_PREFIX} Event ${suffix}`},
            now() - interval '1 day', now() + interval '30 days',
            ${options.quota ?? null}, 'published', ${options.adminId},
            ${points.length}, ${points.reduce((a, b) => a + b, 0)}, now())
    RETURNING id
  `)) as unknown as { id: number }[];

  const eventId = eventRows[0].id;
  const materialIds: number[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const rows = (await db.execute<{ id: number }>(sql`
      INSERT INTO materials (event_id, parent_id, title, points, order_index, sequence_index,
                             content_html)
      VALUES (${eventId}, NULL, ${`Materi ${i + 1}`}, ${points[i]}, ${i}, ${i + 1},
              ${`<p>Materi ${i + 1}</p>`})
      RETURNING id
    `)) as unknown as { id: number }[];
    materialIds.push(rows[0].id);
  }

  return { eventId, materialIds, points };
}

/** Membersihkan SELURUH jejak test. Aman dijalankan berulang. */
export async function cleanupTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM enrollments
     WHERE user_id IN (SELECT id FROM users WHERE email::text LIKE ${'%' + TEST_EMAIL_DOMAIN})
        OR event_id IN (SELECT id FROM events WHERE title LIKE ${TEST_EVENT_PREFIX + '%'})
  `);
  await db.execute(sql`
    DELETE FROM events WHERE title LIKE ${TEST_EVENT_PREFIX + '%'}
  `);
  await db.execute(sql`
    DELETE FROM users WHERE email::text LIKE ${'%' + TEST_EMAIL_DOMAIN}
  `);
  await db.execute(sql`DELETE FROM rate_limits WHERE scope LIKE 'test_%'`);
}

/** Snapshot cepat untuk assertion. */
export async function readEnrollment(enrollmentId: number) {
  const rows = (await db.execute<{
    status: string;
    total_points: number;
    completed_material_count: number;
    max_sequence_reached: number;
    current_material_id: number | null;
    completed_at: Date | null;
  }>(sql`
    SELECT status, total_points, completed_material_count, max_sequence_reached,
           current_material_id, completed_at
      FROM enrollments WHERE id = ${enrollmentId}
  `)) as unknown as {
    status: string;
    total_points: number;
    completed_material_count: number;
    max_sequence_reached: number;
    current_material_id: number | null;
    completed_at: Date | null;
  }[];
  return rows[0];
}

export async function readUserPoints(userId: number): Promise<number> {
  const rows = (await db.execute<{ total_points: number }>(sql`
    SELECT total_points FROM users WHERE id = ${userId}
  `)) as unknown as { total_points: number }[];
  return rows[0]?.total_points ?? 0;
}
