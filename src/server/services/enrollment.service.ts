import { sql } from 'drizzle-orm';

import { revalidateEvent } from '../cache/tags';
import { db } from '../db/client';
import type { EnrollmentStatus, EventStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';

/**
 * Enrollment — TDD §4.2 (EPIC 4 story 4.2 ⛔).
 *
 * Aturan inti PRD "satu event hanya bisa diikuti SEKALI per peserta" ditegakkan
 * `UNIQUE (event_id, user_id)` + `ON CONFLICT DO NOTHING` — BUKAN pengecekan UI
 * dan bukan `SELECT` pendahuluan. Race condition ini nyata walau pesertanya
 * sedikit: cukup satu peserta men-double-click.
 */

export type EnrollResult = {
  enrollment: {
    id: number;
    eventId: number;
    userId: number;
    status: EnrollmentStatus;
    currentMaterialId: number | null;
    maxSequenceReached: number;
    totalPoints: number;
    joinedAt: string;
  };
  firstMaterialId: number | null;
  redirectTo: string;
};

type EventLockRow = {
  id: number;
  status: EventStatus;
  quota: number | null;
  enrolled_count: number;
};

type EnrollmentRow = {
  id: number;
  event_id: number;
  user_id: number;
  status: EnrollmentStatus;
  current_material_id: number | null;
  max_sequence_reached: number;
  total_points: number;
  joined_at: Date;
};

function toEnrollResult(row: EnrollmentRow, firstMaterialId: number | null): EnrollResult {
  return {
    enrollment: {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      status: row.status,
      currentMaterialId: row.current_material_id,
      maxSequenceReached: row.max_sequence_reached,
      totalPoints: row.total_points,
      joinedAt: new Date(row.joined_at).toISOString(),
    },
    firstMaterialId,
    redirectTo: firstMaterialId
      ? `/events/${row.event_id}/materials/${firstMaterialId}`
      : `/events/${row.event_id}`,
  };
}

/**
 * Transaksi join event — PERSIS urutan TDD §4.2:
 *
 *   1. `SELECT … FOR UPDATE` pada `events` agar validasi kuota tidak balapan.
 *   2. `INSERT … ON CONFLICT (event_id,user_id) DO NOTHING` — unique constraint
 *      inilah penjaga sesungguhnya.
 *   3. `UPDATE events SET enrolled_count = enrolled_count + 1`.
 *
 * Lock hanya dipegang selama transaksi join (< 5 ms) dan hanya menyerialkan
 * peserta pada event YANG SAMA. Urutan lock `events` → `enrollments` mengikuti
 * urutan baku §4.3; deviasi dari urutan itu adalah penyebab deadlock.
 */
export async function enroll(eventId: number, userId: number): Promise<EnrollResult> {
  const outcome = await db.transaction(async (tx) => {
    // 1. Kunci baris event.
    const eventRows = (await tx.execute<EventLockRow>(sql`
      SELECT id, status, quota, enrolled_count
        FROM events WHERE id = ${eventId} FOR UPDATE
    `)) as unknown as EventLockRow[];

    const event = eventRows[0];
    if (!event) throw new AppError('EVENT_NOT_FOUND');
    if (event.status !== 'published') throw new AppError('EVENT_NOT_PUBLISHED');

    if (event.quota !== null && event.enrolled_count >= event.quota) {
      throw new AppError('QUOTA_FULL', {
        quota: event.quota,
        enrolledCount: event.enrolled_count,
      });
    }

    const firstRows = (await tx.execute<{ id: number }>(sql`
      SELECT id FROM materials WHERE event_id = ${eventId} AND sequence_index = 1
    `)) as unknown as { id: number }[];
    const firstMaterialId = firstRows[0]?.id ?? null;

    // 2. Insert; `max_sequence_reached = 1` membuka materi pertama saja (§4.5).
    const inserted = (await tx.execute<EnrollmentRow>(sql`
      INSERT INTO enrollments (event_id, user_id, current_material_id, max_sequence_reached)
      VALUES (${eventId}, ${userId}, ${firstMaterialId}, 1)
      ON CONFLICT (event_id, user_id) DO NOTHING
      RETURNING id, event_id, user_id, status, current_material_id,
                max_sequence_reached, total_points, joined_at
    `)) as unknown as EnrollmentRow[];

    // 0 baris → peserta sudah pernah join. Transaksi tidak menulis apa pun.
    if (!inserted[0]) return { conflicted: true as const };

    // 3. Denormalisasi jumlah peserta (dipakai validasi kuota & kartu katalog).
    await tx.execute(sql`
      UPDATE events SET enrolled_count = enrolled_count + 1 WHERE id = ${eventId}
    `);

    return { conflicted: false as const, row: inserted[0], firstMaterialId };
  });

  if (outcome.conflicted) {
    // `409 ALREADY_ENROLLED` WAJIB menyertakan `resumeUrl` (§3.5) supaya UI
    // mengarahkan ke Resume, bukan menampilkan error merah.
    const existing = (await db.execute<{ id: number; current_material_id: number | null }>(sql`
      SELECT id, current_material_id FROM enrollments
       WHERE event_id = ${eventId} AND user_id = ${userId}
    `)) as unknown as { id: number; current_material_id: number | null }[];

    const row = existing[0];
    throw new AppError('ALREADY_ENROLLED', {
      enrollmentId: row?.id ?? null,
      resumeUrl: row?.current_material_id
        ? `/events/${eventId}/materials/${row.current_material_id}`
        : `/events/${eventId}`,
    });
  }

  // Angka "N Participants" di kartu katalog berubah — segarkan cache event.
  revalidateEvent(eventId);
  return toEnrollResult(outcome.row, outcome.firstMaterialId);
}
