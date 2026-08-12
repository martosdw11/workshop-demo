import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb, db } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import { createResponse } from '@/server/services/response.service';
import { completeMaterial } from '@/server/services/scoring.service';

import {
  cleanupTestData,
  createTestEvent,
  createTestUser,
  readEnrollment,
  readUserPoints,
} from '../helpers/fixtures';

/**
 * Uji konkurensi pra-rilis — TDD §11.4.
 *
 * Uji beban skala besar (k6) memang dihapus dari rencana; yang TIDAK bisa
 * dihapus adalah uji yang membuktikan KEBENARAN DI BAWAH KONKURENSI, karena
 * kelas bug ini tidak hilang hanya karena pesertanya sedikit.
 *
 * Diuji di lapisan SERVICE, bukan HTTP: rate limit (§9.3) adalah peredam
 * double-click yang akan menolak sebagian request sebelum transaksi berjalan,
 * sehingga menguji lewat HTTP justru menyembunyikan race yang ingin dibuktikan.
 */

let admin: SessionUser;

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestUser({ role: 'admin' });
});

afterAll(async () => {
  await cleanupTestData();
  await closeDb();
});

const codeOf = (reason: unknown) => (reason as { code?: string }).code;

describe('TDD §11.4 — kebenaran di bawah konkurensi', () => {
  it('50 enroll paralel dari SATU user → tepat 1 enrollment', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id, quota: null });

    const hasil = await Promise.allSettled(
      Array.from({ length: 50 }, () => enroll(event.eventId, user.id)),
    );

    const sukses = hasil.filter((r) => r.status === 'fulfilled');
    const duplikat = hasil.filter(
      (r) => r.status === 'rejected' && codeOf(r.reason) === 'ALREADY_ENROLLED',
    );

    expect(sukses).toHaveLength(1);
    expect(duplikat).toHaveLength(49);

    const rows = (await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM enrollments
       WHERE event_id = ${event.eventId} AND user_id = ${user.id}
    `)) as unknown as { n: number }[];
    expect(rows[0].n).toBe(1);

    // Denormalisasi `enrolled_count` tidak boleh ikut bertambah 50 kali.
    const counter = (await db.execute<{ enrolled_count: number }>(sql`
      SELECT enrolled_count FROM events WHERE id = ${event.eventId}
    `)) as unknown as { enrolled_count: number }[];
    expect(counter[0].enrolled_count).toBe(1);
  });

  it('20 enroll paralel pada event bersisa kuota 5 → tepat 5 berhasil', async () => {
    const event = await createTestEvent({ adminId: admin.id, quota: 5 });
    const peserta = await Promise.all(Array.from({ length: 20 }, () => createTestUser()));

    const hasil = await Promise.allSettled(peserta.map((u) => enroll(event.eventId, u.id)));

    const sukses = hasil.filter((r) => r.status === 'fulfilled');
    const penuh = hasil.filter((r) => r.status === 'rejected' && codeOf(r.reason) === 'QUOTA_FULL');

    expect(sukses).toHaveLength(5);
    expect(penuh).toHaveLength(15);

    const rows = (await db.execute<{ n: number; enrolled_count: number }>(sql`
      SELECT (SELECT count(*)::int FROM enrollments WHERE event_id = ${event.eventId}) AS n,
             enrolled_count
        FROM events WHERE id = ${event.eventId}
    `)) as unknown as { n: number; enrolled_count: number }[];

    expect(rows[0].n).toBe(5);
    // Kuota tidak boleh terlampaui, dan counter harus cocok dengan baris nyata.
    expect(rows[0].enrolled_count).toBe(5);
  });

  it('10 complete paralel pada materi yang sama → poin bertambah SEKALI', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id, points: [50, 30, 20] });
    const { enrollment } = await enroll(event.eventId, user.id);

    await createResponse(event.materialIds[0], user, { type: 'answer', content: 'Jawaban saya.' });

    const hasil = await Promise.allSettled(
      Array.from({ length: 10 }, () => completeMaterial(event.materialIds[0], user)),
    );

    const sukses = hasil.filter((r) => r.status === 'fulfilled');
    expect(sukses).toHaveLength(10); // semuanya 200 — idempoten, bukan error

    const alreadyCompleted = sukses.filter(
      (r) => (r as PromiseFulfilledResult<{ reason: string }>).value.reason === 'ALREADY_COMPLETED',
    );
    expect(alreadyCompleted).toHaveLength(9);

    const snapshot = await readEnrollment(enrollment.id);
    expect(snapshot.total_points).toBe(50);
    expect(snapshot.completed_material_count).toBe(1);
    expect(await readUserPoints(user.id)).toBe(50);

    const progressRows = (await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM material_progress
       WHERE enrollment_id = ${enrollment.id} AND material_id = ${event.materialIds[0]}
    `)) as unknown as { n: number }[];
    expect(progressRows[0].n).toBe(1);
  });

  it('urutan lock baku menahan deadlock: 10 peserta menyelesaikan 3 materi serentak', async () => {
    const event = await createTestEvent({ adminId: admin.id, points: [10, 10, 10] });
    const peserta = await Promise.all(Array.from({ length: 10 }, () => createTestUser()));
    await Promise.all(peserta.map((u) => enroll(event.eventId, u.id)));

    const hasil = await Promise.allSettled(
      peserta.map(async (u) => {
        for (const materialId of event.materialIds) {
          await createResponse(materialId, u, { type: 'answer', content: 'Jawaban.' });
          await completeMaterial(materialId, u);
        }
        return readUserPoints(u.id);
      }),
    );

    const gagal = hasil.filter((r) => r.status === 'rejected');
    expect(gagal).toHaveLength(0);
    for (const r of hasil) {
      expect((r as PromiseFulfilledResult<number>).value).toBe(30);
    }
  });
});
