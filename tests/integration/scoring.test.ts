import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import { finishEnrollment } from '@/server/services/learning.service';
import { createResponse } from '@/server/services/response.service';
import { completeMaterial } from '@/server/services/scoring.service';

import {
  cleanupTestData,
  createTestEvent,
  createTestUser,
  readEnrollment,
  readUserPoints,
  type TestEvent,
} from '../helpers/fixtures';

/**
 * Unit/integrasi scoring engine — TDD §4.1, §4.3, §4.4 (EPIC 8 story 8.4).
 *
 * Kriteria (prompt Batch 7):
 *  - ada `answer`            → poin penuh
 *  - hanya `comment`/`issue` → 0 poin
 *  - panggil 2×              → poin tidak dobel
 *  - `POST /responses` setelah finish → ditolak `ENROLLMENT_COMPLETED`
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

async function setup(points: number[] = [50, 30, 20]) {
  const user = await createTestUser();
  const event: TestEvent = await createTestEvent({ adminId: admin.id, points });
  const { enrollment } = await enroll(event.eventId, user.id);
  return { user, event, enrollmentId: enrollment.id };
}

describe('scoring engine (TDD §4.1)', () => {
  it('ada respons answer → poin PENUH, reason ANSWER_PRESENT', async () => {
    const { user, event, enrollmentId } = await setup([50, 30, 20]);

    await createResponse(event.materialIds[0], user, { type: 'answer', content: 'Jawaban saya.' });
    const result = await completeMaterial(event.materialIds[0], user);

    expect(result.awarded).toBe(true);
    expect(result.reason).toBe('ANSWER_PRESENT');
    expect(result.pointsEarned).toBe(50);
    expect(result.pointsAvailable).toBe(50);
    expect(result.enrollment.totalPoints).toBe(50);

    // Akumulasi lintas event di `users` ikut naik pada transaksi yang sama (§4.3).
    expect(await readUserPoints(user.id)).toBe(50);
    expect((await readEnrollment(enrollmentId)).total_points).toBe(50);
  });

  it('hanya comment/issue → 0 poin, reason NO_ANSWER_RESPONSE', async () => {
    const { user, event, enrollmentId } = await setup([50, 30, 20]);

    await createResponse(event.materialIds[0], user, { type: 'comment', content: 'Komentar.' });
    await createResponse(event.materialIds[0], user, { type: 'issue', content: 'Ada kendala.' });
    const result = await completeMaterial(event.materialIds[0], user);

    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('NO_ANSWER_RESPONSE');
    expect(result.pointsEarned).toBe(0);
    // All-or-nothing: tidak ada nilai parsial walau ada dua respons.
    expect(result.pointsAvailable).toBe(50);
    expect(await readUserPoints(user.id)).toBe(0);
    expect((await readEnrollment(enrollmentId)).completed_material_count).toBe(1);
  });

  it('dipanggil 2× → poin TIDAK dobel, reason ALREADY_COMPLETED', async () => {
    const { user, event, enrollmentId } = await setup([50, 30, 20]);

    await createResponse(event.materialIds[0], user, { type: 'answer', content: 'Jawaban.' });
    const pertama = await completeMaterial(event.materialIds[0], user);
    const kedua = await completeMaterial(event.materialIds[0], user);

    expect(pertama.pointsEarned).toBe(50);
    expect(kedua.reason).toBe('ALREADY_COMPLETED');
    expect(kedua.pointsEarned).toBe(50);
    expect(kedua.enrollment.totalPoints).toBe(50);

    const snapshot = await readEnrollment(enrollmentId);
    expect(snapshot.total_points).toBe(50);
    expect(snapshot.completed_material_count).toBe(1);
    expect(await readUserPoints(user.id)).toBe(50);
  });

  it('materi terkunci ditolak MATERIAL_LOCKED', async () => {
    const { user, event } = await setup([50, 30, 20]);
    await expect(completeMaterial(event.materialIds[2], user)).rejects.toMatchObject({
      code: 'MATERIAL_LOCKED',
      status: 403,
    });
  });
});

describe('finish & penguncian (TDD §4.5)', () => {
  async function selesaikanSemua(points: number[] = [50, 30, 20]) {
    const ctx = await setup(points);
    for (const materialId of ctx.event.materialIds) {
      await createResponse(materialId, ctx.user, { type: 'answer', content: 'Jawaban.' });
      await completeMaterial(materialId, ctx.user);
    }
    return ctx;
  }

  it('finish sebelum materi terakhir ditolak NOT_AT_LAST_MATERIAL', async () => {
    const { user, event, enrollmentId } = await setup([50, 30, 20]);
    await completeMaterial(event.materialIds[0], user);

    await expect(finishEnrollment(enrollmentId, user)).rejects.toMatchObject({
      code: 'NOT_AT_LAST_MATERIAL',
      status: 403,
    });
  });

  it('finish idempoten: panggilan ke-2 tidak mengubah completed_at', async () => {
    const { user, enrollmentId } = await selesaikanSemua();

    const pertama = await finishEnrollment(enrollmentId, user);
    const kedua = await finishEnrollment(enrollmentId, user);

    expect(pertama.enrollment.status).toBe('completed');
    expect(kedua.enrollment.completedAt).toBe(pertama.enrollment.completedAt);
    expect(kedua.summary.pointsEarned).toBe(pertama.summary.pointsEarned);
    expect(kedua.summary.materialsCompleted).toBe(kedua.summary.materialsTotal);
  });

  it('POST /responses setelah finish → 403 ENROLLMENT_COMPLETED', async () => {
    const { user, event, enrollmentId } = await selesaikanSemua();
    await finishEnrollment(enrollmentId, user);

    await expect(
      createResponse(event.materialIds[0], user, { type: 'comment', content: 'Masih boleh?' }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_COMPLETED', status: 403 });

    await expect(completeMaterial(event.materialIds[0], user)).rejects.toMatchObject({
      code: 'ENROLLMENT_COMPLETED',
    });
  });
});

describe('anti-IDOR (TDD §5.2)', () => {
  it('peserta lain tidak bisa menyentuh enrollment yang bukan miliknya', async () => {
    const { enrollmentId } = await setup();
    const orangLain = await createTestUser();

    await expect(finishEnrollment(enrollmentId, orangLain)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});
