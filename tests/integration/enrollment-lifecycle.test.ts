import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb, db } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import {
  finishEnrollment,
  getEnrollmentDetail,
  getMaterialForParticipant,
  getParticipantDashboard,
} from '@/server/services/learning.service';
import { createResponse } from '@/server/services/response.service';
import { completeMaterial } from '@/server/services/scoring.service';

import {
  cleanupTestData,
  createTestEvent,
  createTestUser,
  readEnrollment,
} from '../helpers/fixtures';

/**
 * Siklus hidup enrollment & learning path — TDD §4.2, §4.5 (EPIC 4–5).
 *
 * Melengkapi concurrency.test.ts (race) dan scoring.test.ts (poin): fokusnya
 * guard enroll, pointer resume, state lock di path, dan KPI dashboard.
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

describe('guard enroll (TDD §4.2)', () => {
  it('event draft ditolak 403 EVENT_NOT_PUBLISHED', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });
    await db.execute(sql`UPDATE events SET status = 'draft' WHERE id = ${event.eventId}`);

    await expect(enroll(event.eventId, user.id)).rejects.toMatchObject({
      code: 'EVENT_NOT_PUBLISHED',
      status: 403,
    });
  });

  it('event tidak ada ditolak 404 EVENT_NOT_FOUND', async () => {
    const user = await createTestUser();
    await expect(enroll(999_999_999, user.id)).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
      status: 404,
    });
  });

  it('enroll kedua → 409 ALREADY_ENROLLED dengan details.resumeUrl (§3.5)', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });
    await enroll(event.eventId, user.id);

    await expect(enroll(event.eventId, user.id)).rejects.toMatchObject({
      code: 'ALREADY_ENROLLED',
      status: 409,
      details: {
        resumeUrl: `/events/${event.eventId}/materials/${event.materialIds[0]}`,
      },
    });
  });

  it('enroll sukses membuka HANYA materi pertama', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });

    const result = await enroll(event.eventId, user.id);

    expect(result.enrollment.currentMaterialId).toBe(event.materialIds[0]);
    expect(result.enrollment.maxSequenceReached).toBe(1);
    expect(result.redirectTo).toBe(`/events/${event.eventId}/materials/${event.materialIds[0]}`);
  });
});

describe('pointer resume & state lock (TDD §4.5)', () => {
  it('complete materi 1 menggeser pointer ke materi 2 dan membukanya', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id, points: [50, 30, 20] });
    const { enrollment } = await enroll(event.eventId, user.id);

    // Materi 2 masih terkunci sebelum materi 1 selesai.
    await expect(getMaterialForParticipant(event.materialIds[1], user)).rejects.toMatchObject({
      code: 'MATERIAL_LOCKED',
      status: 403,
    });

    await createResponse(event.materialIds[0], user, { type: 'answer', content: 'Jawaban.' });
    await completeMaterial(event.materialIds[0], user);

    const snapshot = await readEnrollment(enrollment.id);
    expect(snapshot.current_material_id).toBe(event.materialIds[1]);
    expect(snapshot.max_sequence_reached).toBe(2);

    // Materi 2 kini terbuka, dengan prev/next/isLast yang benar.
    const material2 = await getMaterialForParticipant(event.materialIds[1], user);
    expect(material2.prevId).toBe(event.materialIds[0]);
    expect(material2.nextId).toBe(event.materialIds[2]);
    expect(material2.isLast).toBe(false);

    // Materi 3 tetap terkunci — max_sequence_reached tidak melompat.
    await expect(getMaterialForParticipant(event.materialIds[2], user)).rejects.toMatchObject({
      code: 'MATERIAL_LOCKED',
    });
  });

  it('path sidebar memakai tiga state: completed / active / locked (§6.6)', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });
    const { enrollment } = await enroll(event.eventId, user.id);

    await completeMaterial(event.materialIds[0], user);

    const detail = await getEnrollmentDetail(enrollment.id, user);
    const states = detail.path.map((node) => node.state);
    expect(states).toEqual(['completed', 'active', 'locked']);
    expect(detail.progressPercent).toBe(33);
  });
});

describe('dashboard peserta (TDD §3.3)', () => {
  it('KPI dan achievement mengikuti finish', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id, points: [50, 30, 20] });
    const { enrollment } = await enroll(event.eventId, user.id);

    for (const materialId of event.materialIds) {
      await createResponse(materialId, user, { type: 'answer', content: 'Jawaban.' });
      await completeMaterial(materialId, user);
    }
    await finishEnrollment(enrollment.id, user);

    const dashboard = await getParticipantDashboard(user);
    expect(dashboard.kpi.totalEventsJoined).toBe(1);
    expect(dashboard.kpi.activeEvents).toBe(0);
    expect(dashboard.kpi.completedEvents).toBe(1);
    expect(dashboard.kpi.totalPoints).toBe(100);
    expect(dashboard.continueLearning).toBeNull();
    expect(dashboard.achievements[0]).toMatchObject({
      enrollmentId: enrollment.id,
      pointsEarned: 100,
      pointsAvailable: 100,
    });
  });
});
