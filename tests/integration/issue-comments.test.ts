import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb, db } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import { adminDeleteResponse } from '@/server/services/event-detail.service';
import {
  createIssueComment,
  deleteIssueComment,
  listIssueComments,
  updateOwnIssueComment,
} from '@/server/services/issue-comment.service';
import { createResponse, listResponses } from '@/server/services/response.service';

import { cleanupTestData, createTestEvent, createTestUser, type TestEvent } from '../helpers/fixtures';

/**
 * Thread komentar issue — dukungan lintas peserta + admin.
 *
 * Aturan:
 *  - seluruh peserta ter-enroll pada event pemilik issue boleh membaca &
 *    berkomentar (membantu issue temannya); yang tidak ter-enroll `403`;
 *  - admin boleh tanpa enrollment (badge `isAdmin`);
 *  - thread hanya untuk `type='issue'` (`422 NOT_AN_ISSUE`);
 *  - edit hanya penulisnya; hapus penulisnya ATAU admin;
 *  - komentar ikut lenyap saat issue-nya dihapus (FK CASCADE);
 *  - `commentCount` muncul di listing respons.
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

async function setupIssue() {
  const event: TestEvent = await createTestEvent({ adminId: admin.id, points: [50, 50] });
  const userA = await createTestUser();
  const userB = await createTestUser();
  await enroll(event.eventId, userA.id);
  await enroll(event.eventId, userB.id);
  const { response: issue } = await createResponse(event.materialIds[0], userA, {
    type: 'issue',
    content: 'Kendala A.',
  });
  return { event, userA, userB, issue };
}

describe('akses thread', () => {
  it('peserta lain di event yang sama bisa membantu; admin ikut tanpa enrollment', async () => {
    const { userA, userB, issue } = await setupIssue();

    const dariB = await createIssueComment(issue.id, userB, {
      content: 'Coba matikan VPN dulu.',
    });
    expect(dariB.author.id).toBe(userB.id);
    expect(dariB.author.isAdmin).toBe(false);

    const dariAdmin = await createIssueComment(issue.id, admin, {
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Sudah kami perbaiki.', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    });
    expect(dariAdmin.author.isAdmin).toBe(true);
    expect(dariAdmin.contentHtml).toContain('<strong>Sudah kami perbaiki.</strong>');

    // Kronologis naik: B dulu, lalu admin; penulis issue ikut membaca.
    const thread = await listIssueComments(issue.id, userA);
    expect(thread.items.map((item) => item.author.id)).toEqual([userB.id, admin.id]);
  });

  it('user yang TIDAK ter-enroll ditolak FORBIDDEN', async () => {
    const { issue } = await setupIssue();
    const outsider = await createTestUser();

    await expect(listIssueComments(issue.id, outsider)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    await expect(
      createIssueComment(issue.id, outsider, { content: 'Nimbrung.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('thread hanya untuk issue — jawaban ditolak NOT_AN_ISSUE', async () => {
    const { event, userA } = await setupIssue();
    const { response: jawaban } = await createResponse(event.materialIds[0], userA, {
      type: 'answer',
      content: 'Jawaban.',
    });

    await expect(
      createIssueComment(jawaban.id, userA, { content: 'Komentar nyasar.' }),
    ).rejects.toMatchObject({ code: 'NOT_AN_ISSUE', status: 422 });
  });
});

describe('mutasi komentar', () => {
  it('edit hanya penulisnya; hapus penulisnya atau admin', async () => {
    const { userA, userB, issue } = await setupIssue();
    const komentar = await createIssueComment(issue.id, userB, { content: 'Saran awal.' });

    const diedit = await updateOwnIssueComment(komentar.id, userB, { content: 'Saran revisi.' });
    expect(diedit.content).toBe('Saran revisi.');
    expect(diedit.editedAt).not.toBeNull();

    // Penulis issue ≠ penulis komentar: tidak boleh mengubah/menghapus.
    await expect(
      updateOwnIssueComment(komentar.id, userA, { content: 'Diambil alih.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(deleteIssueComment(komentar.id, userA)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    // Admin pun tidak meng-edit milik orang — hanya menghapus (moderasi).
    await expect(
      updateOwnIssueComment(komentar.id, admin, { content: 'Disunting admin.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await deleteIssueComment(komentar.id, admin);
    await expect(deleteIssueComment(komentar.id, admin)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('integrasi dengan listing & penghapusan issue', () => {
  it('commentCount muncul di listing respons; komentar ikut lenyap saat issue dihapus', async () => {
    const { event, userA, userB, issue } = await setupIssue();

    await createIssueComment(issue.id, userB, { content: 'Satu.' });
    await createIssueComment(issue.id, admin, { content: 'Dua.' });

    const timeline = await listResponses(event.materialIds[0], userA, { type: 'issue', limit: 20 });
    expect(timeline.items[0].commentCount).toBe(2);

    await adminDeleteResponse(issue.id);
    const sisa = (await db.execute<{ jumlah: number }>(sql`
      SELECT count(*)::int AS jumlah FROM issue_comments WHERE response_id = ${issue.id}
    `)) as unknown as { jumlah: number }[];
    expect(Number(sisa[0].jumlah)).toBe(0);
  });
});
