import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb, db } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import { adminDeleteResponse } from '@/server/services/event-detail.service';
import {
  createResponse,
  deleteOwnResponse,
  listResponses,
  updateOwnResponse,
} from '@/server/services/response.service';

import { cleanupTestData, createTestEvent, createTestUser, type TestEvent } from '../helpers/fixtures';

/**
 * Fitur edit/hapus respons milik sendiri + moderasi admin.
 *
 * Aturan:
 *  - penulis boleh meng-edit & menghapus respons miliknya sendiri — SEMUA
 *    tipe (jawaban, komentar, issue);
 *  - milik peserta lain: `403 FORBIDDEN` — membantu ≠ mengubah pesan orang;
 *  - setelah finish: `403 ENROLLMENT_COMPLETED` (§4.5);
 *  - admin all-access: hapus respons apa pun (`adminDeleteResponse`).
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

async function setupDuaPeserta() {
  const event: TestEvent = await createTestEvent({ adminId: admin.id, points: [50, 50] });
  const userA = await createTestUser();
  const userB = await createTestUser();
  await enroll(event.eventId, userA.id);
  await enroll(event.eventId, userB.id);
  return { event, userA, userB };
}

describe('edit respons milik sendiri', () => {
  it('penulis meng-edit issue-nya: konten berganti, editedAt terisi', async () => {
    const { event, userA } = await setupDuaPeserta();
    const { response } = await createResponse(event.materialIds[0], userA, {
      type: 'issue',
      content: 'Kendala awal.',
    });
    expect(response.editedAt).toBeNull();

    const updated = await updateOwnResponse(response.id, userA, {
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Kendala revisi', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    });

    expect(updated.content).toBe('Kendala revisi');
    expect(updated.contentHtml).toContain('<strong>Kendala revisi</strong>');
    expect(updated.editedAt).not.toBeNull();
    expect(updated.issueStatus).toBe('open');
  });

  it('issue milik peserta lain ditolak FORBIDDEN', async () => {
    const { event, userA, userB } = await setupDuaPeserta();
    const { response } = await createResponse(event.materialIds[0], userB, {
      type: 'issue',
      content: 'Kendala B.',
    });

    await expect(
      updateOwnResponse(response.id, userA, { content: 'Diambil alih.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(deleteOwnResponse(response.id, userA)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('jawaban & komentar milik sendiri juga bisa diedit dan dihapus', async () => {
    const { event, userA } = await setupDuaPeserta();
    const materialId = event.materialIds[0];
    const { response: jawaban } = await createResponse(materialId, userA, {
      type: 'answer',
      content: 'Jawaban.',
    });
    const { response: komentar } = await createResponse(materialId, userA, {
      type: 'comment',
      content: 'Komentar.',
    });

    const updated = await updateOwnResponse(jawaban.id, userA, { content: 'Jawaban revisi.' });
    expect(updated.content).toBe('Jawaban revisi.');
    expect(updated.type).toBe('answer');
    expect(updated.editedAt).not.toBeNull();

    await deleteOwnResponse(komentar.id, userA);
    const timeline = await listResponses(materialId, userA, { type: 'comment', limit: 20 });
    expect(timeline.items).toHaveLength(0);
  });

  it('setelah enrollment completed ditolak ENROLLMENT_COMPLETED', async () => {
    const { event, userA } = await setupDuaPeserta();
    const { response } = await createResponse(event.materialIds[0], userA, {
      type: 'issue',
      content: 'Kendala sebelum finish.',
    });

    await db.execute(sql`
      UPDATE enrollments SET status = 'completed', completed_at = now()
       WHERE id = ${response.enrollmentId}
    `);

    await expect(
      updateOwnResponse(response.id, userA, { content: 'Telat edit.' }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_COMPLETED', status: 403 });
  });
});

describe('hapus respons', () => {
  it('penulis menghapus issue-nya sendiri → hilang dari timeline', async () => {
    const { event, userA } = await setupDuaPeserta();
    const materialId = event.materialIds[0];
    const { response } = await createResponse(materialId, userA, {
      type: 'issue',
      content: 'Akan dihapus.',
    });

    await deleteOwnResponse(response.id, userA);

    const timeline = await listResponses(materialId, userA, { type: 'issue', limit: 20 });
    expect(timeline.items).toHaveLength(0);
  });

  it('admin all-access: menghapus respons milik siapa pun, tipe apa pun', async () => {
    const { event, userB } = await setupDuaPeserta();
    const materialId = event.materialIds[0];
    const { response: jawaban } = await createResponse(materialId, userB, {
      type: 'answer',
      content: 'Jawaban B.',
    });

    await adminDeleteResponse(jawaban.id);

    const timeline = await listResponses(materialId, userB, { type: 'answer', limit: 20 });
    expect(timeline.items).toHaveLength(0);
    // id yang sudah tidak ada → 404, bukan sukses diam-diam.
    await expect(adminDeleteResponse(jawaban.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
