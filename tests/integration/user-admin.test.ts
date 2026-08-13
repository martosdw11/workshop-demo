import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import {
  createEvent,
  deleteEvent,
  setEventPublishStatus,
  updateEvent,
} from '@/server/services/event.service';
import { updateUserRole, updateUserStatus } from '@/server/services/user.service';

import { cleanupTestData, createTestEvent, createTestUser } from '../helpers/fixtures';

/**
 * Guard User Access & siklus event admin — TDD §3.4, §4.6, §5.3
 * (EPIC 3 story 3.3, EPIC 7 story 7.3).
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

describe('user access (TDD §5.3)', () => {
  it('admin tidak bisa menurunkan peran dirinya sendiri', async () => {
    await expect(updateUserRole(admin.id, 'participant', admin)).rejects.toMatchObject({
      code: 'CANNOT_DEMOTE_SELF',
      status: 403,
    });
  });

  it('admin tidak bisa menonaktifkan akunnya sendiri', async () => {
    await expect(updateUserStatus(admin.id, 'inactive', admin)).rejects.toMatchObject({
      code: 'CANNOT_DEACTIVATE_SELF',
      status: 403,
    });
  });

  it('promote lalu demote peserta berjalan dua arah', async () => {
    const user = await createTestUser();

    const promoted = await updateUserRole(user.id, 'admin', admin);
    expect(promoted.role).toBe('admin');

    const demoted = await updateUserRole(user.id, 'participant', admin);
    expect(demoted.role).toBe('participant');
  });

  it('user tidak dikenal → USER_NOT_FOUND', async () => {
    await expect(updateUserRole(999_999_999, 'admin', admin)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      status: 404,
    });
  });
});

describe('siklus publish event (TDD §4.6)', () => {
  function draftEventInput() {
    return {
      title: `[TEST] Draft ${process.pid}-${Date.now()}`,
      description: 'Uji guard event.',
      startAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      quota: null,
      coverUrl: null,
    };
  }

  it('publish tanpa materi ditolak EVENT_HAS_NO_MATERIAL', async () => {
    const event = await createEvent(draftEventInput(), admin.id);
    expect(event.status).toBe('draft');

    await expect(setEventPublishStatus(event.id, 'published')).rejects.toMatchObject({
      code: 'EVENT_HAS_NO_MATERIAL',
      status: 422,
    });
  });

  it('unpublish event berpeserta ditolak CANNOT_UNPUBLISH_WITH_ENROLLMENTS', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });
    await enroll(event.eventId, user.id);

    await expect(setEventPublishStatus(event.eventId, 'draft')).rejects.toMatchObject({
      code: 'CANNOT_UNPUBLISH_WITH_ENROLLMENTS',
      status: 409,
    });
  });

  it('hapus event berpeserta ditolak EVENT_HAS_ENROLLMENTS; tanpa peserta boleh', async () => {
    const user = await createTestUser();
    const berpeserta = await createTestEvent({ adminId: admin.id });
    await enroll(berpeserta.eventId, user.id);

    await expect(deleteEvent(berpeserta.eventId)).rejects.toMatchObject({
      code: 'EVENT_HAS_ENROLLMENTS',
      status: 409,
    });

    const kosong = await createTestEvent({ adminId: admin.id });
    await deleteEvent(kosong.eventId);
    await expect(deleteEvent(kosong.eventId)).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
      status: 404,
    });
  });
});

describe('field immutable setelah publish (A-B05)', () => {
  it('startAt tidak bisa diubah setelah published', async () => {
    const event = await createTestEvent({ adminId: admin.id });

    await expect(
      updateEvent(event.eventId, {
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'EVENT_PUBLISHED_IMMUTABLE_FIELD',
      status: 403,
      details: { field: 'startAt' },
    });
  });

  it('quota tidak bisa diturunkan di bawah enrolled_count', async () => {
    const event = await createTestEvent({ adminId: admin.id, quota: 5 });
    await enroll(event.eventId, (await createTestUser()).id);
    await enroll(event.eventId, (await createTestUser()).id);

    await expect(updateEvent(event.eventId, { quota: 1 })).rejects.toMatchObject({
      code: 'EVENT_PUBLISHED_IMMUTABLE_FIELD',
      status: 403,
      details: { field: 'quota', enrolledCount: 2 },
    });

    // Judul tetap boleh diubah kapan saja.
    const updated = await updateEvent(event.eventId, { title: '[TEST] Judul revisi' });
    expect(updated.title).toBe('[TEST] Judul revisi');
  });
});
