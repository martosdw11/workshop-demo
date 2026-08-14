import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import { createResponse, listResponses } from '@/server/services/response.service';

import { cleanupTestData, createTestEvent, createTestUser, type TestEvent } from '../helpers/fixtures';

/**
 * Revisi A-B08 + rich editor respons.
 *
 * 1. Timeline `answer`/`comment` HANYA memuat respons milik pemanggil —
 *    respons peserta lain tidak boleh bocor lewat endpoint peserta; `issue`
 *    sengaja terlihat lintas peserta (kendala dialami bersama).
 *    (Admin melihat semuanya lewat layar admin, bukan endpoint ini.)
 * 2. Jalur `contentJson`: plain text diekstraksi ke `content`, HTML tersanitasi
 *    tersimpan di `content_html`; dokumen kosong ditolak VALIDATION_ERROR.
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

describe('visibilitas timeline peserta (revisi A-B08)', () => {
  it('answer/comment hanya milik sendiri; issue terlihat lintas peserta', async () => {
    const { event, userA, userB } = await setupDuaPeserta();
    const materialId = event.materialIds[0];

    await createResponse(materialId, userA, { type: 'answer', content: 'Jawaban A.' });
    await createResponse(materialId, userB, { type: 'answer', content: 'Jawaban B.' });
    await createResponse(materialId, userB, { type: 'comment', content: 'Komentar B.' });
    await createResponse(materialId, userB, { type: 'issue', content: 'Kendala B.' });

    const jawabanA = await listResponses(materialId, userA, { type: 'answer', limit: 20 });
    expect(jawabanA.items).toHaveLength(1);
    expect(jawabanA.items[0].content).toBe('Jawaban A.');
    expect(jawabanA.items[0].author.id).toBe(userA.id);

    // Issue milik B tetap terlihat oleh A.
    const issueA = await listResponses(materialId, userA, { type: 'issue', limit: 20 });
    expect(issueA.items).toHaveLength(1);
    expect(issueA.items[0].content).toBe('Kendala B.');
    expect(issueA.items[0].author.id).toBe(userB.id);

    // Tanpa filter tipe: milik sendiri + seluruh issue.
    const timelineB = await listResponses(materialId, userB, { limit: 20 });
    expect(timelineB.items).toHaveLength(3);
    const timelineA = await listResponses(materialId, userA, { limit: 20 });
    expect(timelineA.items.map((item) => item.content).sort()).toEqual([
      'Jawaban A.',
      'Kendala B.',
    ]);
  });
});

describe('createResponse jalur rich editor (contentJson)', () => {
  it('menyimpan plain text terekstraksi + HTML tersanitasi', async () => {
    const { event, userA } = await setupDuaPeserta();

    const { response } = await createResponse(event.materialIds[0], userA, {
      type: 'answer',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Jawaban ', },
              { type: 'text', text: 'penting', marks: [{ type: 'bold' }] },
            ],
          },
        ],
      },
    });

    expect(response.content).toBe('Jawaban penting');
    expect(response.contentHtml).toContain('<strong>penting</strong>');
  });

  it('jalur plain text lama tetap berjalan; contentHtml null', async () => {
    const { event, userA } = await setupDuaPeserta();

    const { response } = await createResponse(event.materialIds[0], userA, {
      type: 'comment',
      content: 'Komentar polos.',
    });

    expect(response.content).toBe('Komentar polos.');
    expect(response.contentHtml).toBeNull();
  });

  it('dokumen tanpa teks ditolak VALIDATION_ERROR', async () => {
    const { event, userA } = await setupDuaPeserta();

    await expect(
      createResponse(event.materialIds[0], userA, {
        type: 'answer',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
  });
});
