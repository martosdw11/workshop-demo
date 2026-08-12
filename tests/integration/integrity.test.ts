import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { closeDb, db } from '@/server/db/client';

/**
 * GATE RILIS — TDD §11.4 "Verifikasi integritas".
 *
 * Keempat query di bawah ditulis PERSIS seperti di TDD dan HARUS mengembalikan
 * 0 baris. Rilis diblokir bila salah satunya mengembalikan baris.
 *
 * Query ini berjalan pada SELURUH isi database (termasuk data seed dan sisa
 * pemakaian development), bukan hanya fixture test — itu memang tujuannya:
 * membuktikan tidak ada baris rusak di mana pun.
 */

type Row = Record<string, unknown>;
const run = async (query: ReturnType<typeof sql>) =>
  (await db.execute<Row>(query)) as unknown as Row[];

afterAll(async () => {
  await closeDb();
});

describe('query assert integritas (gate rilis §11.4)', () => {
  it('1. tidak ada peserta yang join dua kali', async () => {
    const rows = await run(sql`
      SELECT event_id, user_id, count(*) FROM enrollments
       GROUP BY 1, 2 HAVING count(*) > 1
    `);
    expect(rows).toHaveLength(0);
  });

  it('2. enrollments.total_points = jumlah material_progress.points_earned', async () => {
    const rows = await run(sql`
      SELECT e.id FROM enrollments e
        JOIN material_progress mp ON mp.enrollment_id = e.id
       GROUP BY e.id, e.total_points
      HAVING e.total_points <> sum(mp.points_earned)
    `);
    expect(rows).toHaveLength(0);
  });

  it('3. tidak ada poin diberikan tanpa respons answer', async () => {
    const rows = await run(sql`
      SELECT mp.id FROM material_progress mp
       WHERE mp.points_earned > 0
         AND NOT EXISTS (SELECT 1 FROM responses r
                          WHERE r.enrollment_id = mp.enrollment_id
                            AND r.material_id  = mp.material_id
                            AND r.type = 'answer')
    `);
    expect(rows).toHaveLength(0);
  });

  it('4. tidak ada respons setelah enrollment completed', async () => {
    const rows = await run(sql`
      SELECT r.id FROM responses r JOIN enrollments e ON e.id = r.enrollment_id
       WHERE e.completed_at IS NOT NULL AND r.created_at > e.completed_at
    `);
    expect(rows).toHaveLength(0);
  });
});

/**
 * Invariant tambahan yang ditegakkan constraint database (§2, §9.2).
 * Bukan bagian dari 4 query gate rilis, tapi murah diperiksa di tempat yang sama.
 */
describe('invariant denormalisasi', () => {
  it('events.enrolled_count cocok dengan jumlah baris enrollments', async () => {
    const rows = await run(sql`
      SELECT e.id, e.enrolled_count,
             (SELECT count(*) FROM enrollments en WHERE en.event_id = e.id) AS nyata
        FROM events e
       WHERE e.enrolled_count <> (SELECT count(*) FROM enrollments en WHERE en.event_id = e.id)
    `);
    expect(rows).toHaveLength(0);
  });

  it('events.material_count & total_points cocok dengan tabel materials', async () => {
    const rows = await run(sql`
      SELECT e.id FROM events e
       WHERE e.material_count <> (SELECT count(*) FROM materials m WHERE m.event_id = e.id)
          OR e.total_points   <> (SELECT coalesce(sum(m.points), 0) FROM materials m
                                   WHERE m.event_id = e.id)
    `);
    expect(rows).toHaveLength(0);
  });

  it('sequence_index setiap event membentuk deret 1..N tanpa lompatan', async () => {
    const rows = await run(sql`
      SELECT event_id FROM materials
       GROUP BY event_id
      HAVING min(sequence_index) <> 1
          OR max(sequence_index) <> count(*)
          OR count(DISTINCT sequence_index) <> count(*)
    `);
    expect(rows).toHaveLength(0);
  });

  it('users.total_points = jumlah total_points seluruh enrollment-nya', async () => {
    const rows = await run(sql`
      SELECT u.id, u.total_points,
             coalesce((SELECT sum(en.total_points) FROM enrollments en WHERE en.user_id = u.id), 0) AS nyata
        FROM users u
       WHERE u.total_points <>
             coalesce((SELECT sum(en.total_points) FROM enrollments en WHERE en.user_id = u.id), 0)
    `);
    expect(rows).toHaveLength(0);
  });
});
