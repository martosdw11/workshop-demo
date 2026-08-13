import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { closeDb } from '@/server/db/client';
import { enroll } from '@/server/services/enrollment.service';
import {
  createMaterial,
  deleteMaterial,
  getEventTree,
  reorderMaterials,
} from '@/server/services/material.service';
import { createResponse } from '@/server/services/response.service';
import { completeMaterial } from '@/server/services/scoring.service';

import { cleanupTestData, createTestEvent, createTestUser } from '../helpers/fixtures';

/**
 * Guard kurikulum — TDD §2.4, §4.6 (EPIC 3 story 3.2).
 *
 * Semula hanya dibuktikan smoke.sh lewat HTTP; di sini dipanggil langsung di
 * service layer supaya bisa jalan tanpa server hidup. Dua invariant §2.4 yang
 * diuji: batas 2 level, dan `material_count`/`total_points` yang selalu cocok.
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

describe('batas 2 level (TDD §2.4)', () => {
  it('sub-materi sah, tapi sub-dari-sub ditolak MAX_DEPTH_EXCEEDED', async () => {
    const event = await createTestEvent({ adminId: admin.id, points: [50, 30, 20] });

    const { material: lesson } = await createMaterial(event.eventId, {
      parentId: event.materialIds[0],
      title: 'Lesson 1.1',
      contentJson: null,
      points: 10,
    });
    expect(lesson.depth).toBe(1);
    expect(lesson.parentId).toBe(event.materialIds[0]);

    await expect(
      createMaterial(event.eventId, {
        parentId: lesson.id,
        title: 'Sub dari sub',
        contentJson: null,
        points: 5,
      }),
    ).rejects.toMatchObject({ code: 'MAX_DEPTH_EXCEEDED', status: 422 });
  });
});

describe('rekalkulasi denormalisasi (TDD §2.4)', () => {
  it('tambah & hapus materi menghitung ulang count, poin, dan sequence linier', async () => {
    const event = await createTestEvent({ adminId: admin.id, points: [50, 30, 20] });

    // Sub-materi di bawah root pertama menyisip di URUTAN FLATTEN, bukan di ekor.
    const { summary } = await createMaterial(event.eventId, {
      parentId: event.materialIds[0],
      title: 'Lesson 1.1',
      contentJson: null,
      points: 10,
    });
    expect(summary.materialCount).toBe(4);
    expect(summary.totalPoints).toBe(110);

    const tree = await getEventTree(event.eventId);
    expect(tree.tree.map((node) => node.sequenceIndex)).toEqual([1, 3, 4]);
    expect(tree.tree[0].children[0].sequenceIndex).toBe(2);

    await deleteMaterial(tree.tree[0].children[0].id);
    const after = await getEventTree(event.eventId);
    expect(after.materialCount).toBe(3);
    expect(after.totalPoints).toBe(100);
    expect(after.tree.map((node) => node.sequenceIndex)).toEqual([1, 2, 3]);
  });

  it('materi yang sudah dikerjakan tidak bisa dihapus (MATERIAL_HAS_PROGRESS)', async () => {
    const user = await createTestUser();
    const event = await createTestEvent({ adminId: admin.id });
    await enroll(event.eventId, user.id);
    await createResponse(event.materialIds[0], user, { type: 'answer', content: 'Jawaban.' });
    await completeMaterial(event.materialIds[0], user);

    await expect(deleteMaterial(event.materialIds[0])).rejects.toMatchObject({
      code: 'MATERIAL_HAS_PROGRESS',
      status: 409,
    });
  });
});

describe('reorder (TDD §6.7)', () => {
  it('daftar basi (id tidak lengkap) ditolak STALE_TREE', async () => {
    const event = await createTestEvent({ adminId: admin.id });

    await expect(
      reorderMaterials(event.eventId, {
        items: [{ id: event.materialIds[0], parentId: null, orderIndex: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'STALE_TREE', status: 409 });
  });

  it('parent yang punya parent ditolak MAX_DEPTH_EXCEEDED', async () => {
    const event = await createTestEvent({ adminId: admin.id });
    const [m1, m2, m3] = event.materialIds;

    await expect(
      reorderMaterials(event.eventId, {
        items: [
          { id: m1, parentId: null, orderIndex: 0 },
          { id: m2, parentId: m1, orderIndex: 0 },
          { id: m3, parentId: m2, orderIndex: 0 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MAX_DEPTH_EXCEEDED', status: 422 });
  });

  it('reorder sah menomori ulang sequence dari susunan baru', async () => {
    const event = await createTestEvent({ adminId: admin.id });
    const [m1, m2, m3] = event.materialIds;

    const result = await reorderMaterials(event.eventId, {
      items: [
        { id: m3, parentId: null, orderIndex: 0 },
        { id: m1, parentId: m3, orderIndex: 0 },
        { id: m2, parentId: null, orderIndex: 1 },
      ],
    });

    expect(result.tree.map((node) => node.id)).toEqual([m3, m2]);
    expect(result.tree[0].sequenceIndex).toBe(1);
    expect(result.tree[0].children[0]).toMatchObject({ id: m1, sequenceIndex: 2, depth: 1 });
    expect(result.tree[1].sequenceIndex).toBe(3);
    expect(result.materialCount).toBe(3);
  });
});
