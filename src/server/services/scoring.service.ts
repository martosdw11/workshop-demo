import { sql } from 'drizzle-orm';

import type { ScoringReason } from '@/lib/constants';

import type { SessionUser } from '../auth/session';
import { db } from '../db/client';
import { AppError } from '../http/errors';
import { progressPercent } from './catalog.service';
import {
  assertEnrollmentInProgress,
  assertMaterialUnlocked,
  requireOwnEnrollmentForMaterial,
} from './player.access';

/**
 * Scoring engine — TDD §4.1 & §4.3 (EPIC 5 story 5.3 ⛔).
 *
 * Aturan poin:
 *  1. Poin materi = `materials.points`, ALL-OR-NOTHING — tidak ada nilai parsial.
 *  2. Poin diberikan HANYA bila peserta punya minimal satu respons bertipe
 *     `answer` pada materi itu. `comment` dan `issue` tidak menghasilkan poin.
 *  3. Poin sebuah materi hanya bisa diraih SEKALI — dijamin
 *     `UNIQUE (enrollment_id, material_id)`, bukan pengecekan aplikasi.
 *  4. Penilaian benar/salah jawaban TIDAK ADA di MVP.
 *
 * Idempotensi (§4.4): pemanggilan kedua kena `ON CONFLICT DO NOTHING`, seluruh
 * UPDATE di bawahnya dilewati, dan respons tetap `200` dengan
 * `reason: ALREADY_COMPLETED` — poin tidak bertambah dua kali.
 */

export type CompleteResult = {
  materialId: number;
  pointsEarned: number;
  pointsAvailable: number;
  awarded: boolean;
  reason: ScoringReason;
  enrollment: {
    totalPoints: number;
    completedMaterialCount: number;
    progressPercent: number;
    currentMaterialId: number | null;
  };
  nextMaterialId: number | null;
  isLast: boolean;
};

type LockedEnrollmentRow = {
  id: number;
  status: 'in_progress' | 'completed';
  max_sequence_reached: number;
  total_points: number;
  completed_material_count: number;
  current_material_id: number | null;
  completed_at: Date | null;
};

type NeighbourRow = { id: number; sequence_index: number };

export async function completeMaterial(
  materialId: number,
  user: SessionUser,
): Promise<CompleteResult> {
  const outer = await requireOwnEnrollmentForMaterial(materialId, user);

  return db.transaction(async (tx) => {
    // 1. Kunci baris enrollment. Urutan lock baku §4.3:
    //    `events` → `enrollments` → `material_progress` → `users`.
    const lockedRows = (await tx.execute<LockedEnrollmentRow>(sql`
      SELECT id, status, max_sequence_reached, total_points,
             completed_material_count, current_material_id, completed_at
        FROM enrollments
       WHERE id = ${outer.enrollment.enrollmentId}
       FOR UPDATE
    `)) as unknown as LockedEnrollmentRow[];

    const enrollment = lockedRows[0];
    if (!enrollment) throw new AppError('NOT_FOUND');

    assertEnrollmentInProgress({
      ...outer.enrollment,
      status: enrollment.status,
      completedAt: enrollment.completed_at ? new Date(enrollment.completed_at) : null,
    });
    assertMaterialUnlocked(outer.material, {
      maxSequenceReached: enrollment.max_sequence_reached,
    });

    // 2. Materi berikutnya — satu baris lewat index #8 (§2.4), bukan recursive CTE.
    const nextRows = (await tx.execute<NeighbourRow>(sql`
      SELECT id, sequence_index
        FROM materials
       WHERE event_id = ${outer.material.eventId}
         AND sequence_index > ${outer.material.sequenceIndex}
       ORDER BY sequence_index
       LIMIT 1
    `)) as unknown as NeighbourRow[];

    const next = nextRows[0] ?? null;
    const isLast = next === null;

    // 3. Cek eksistensi jawaban — index #13, index-only scan (§4.3).
    const answerRows = (await tx.execute<{ awarded: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM responses
         WHERE enrollment_id = ${enrollment.id}
           AND material_id = ${materialId}
           AND type = 'answer'
      ) AS awarded
    `)) as unknown as { awarded: boolean }[];

    const hasAnswer = Boolean(answerRows[0]?.awarded);
    const pointsAvailable = outer.material.points;

    // 4. Insert progres. `ON CONFLICT DO NOTHING` inilah jaminan idempotensi.
    const insertedRows = (await tx.execute<{ points_earned: number }>(sql`
      INSERT INTO material_progress (enrollment_id, material_id, status, points_earned)
      VALUES (${enrollment.id}, ${materialId}, 'completed',
              ${hasAnswer ? pointsAvailable : 0})
      ON CONFLICT (enrollment_id, material_id) DO NOTHING
      RETURNING points_earned
    `)) as unknown as { points_earned: number }[];

    // 0 baris → sudah pernah complete: SKIP seluruh update di bawah.
    if (!insertedRows[0]) {
      const existingRows = (await tx.execute<{ points_earned: number }>(sql`
        SELECT points_earned FROM material_progress
         WHERE enrollment_id = ${enrollment.id} AND material_id = ${materialId}
      `)) as unknown as { points_earned: number }[];

      const earnedBefore = existingRows[0]?.points_earned ?? 0;

      return {
        materialId,
        pointsEarned: earnedBefore,
        pointsAvailable,
        awarded: earnedBefore > 0,
        reason: 'ALREADY_COMPLETED' as const,
        enrollment: {
          totalPoints: enrollment.total_points,
          completedMaterialCount: enrollment.completed_material_count,
          progressPercent: progressPercent(
            enrollment.completed_material_count,
            outer.enrollment.materialCount,
          ),
          currentMaterialId: enrollment.current_material_id,
        },
        nextMaterialId: next?.id ?? null,
        isLast,
      };
    }

    const earned = insertedRows[0].points_earned;

    // 5. Update enrollment. `current_material_id` bergeser ke materi berikutnya;
    //    di materi terakhir ia tetap di tempat supaya guard Finish (§4.5) —
    //    "current_material_id = materi dengan sequence_index maksimum" — terpenuhi.
    const updatedRows = (await tx.execute<{
      total_points: number;
      completed_material_count: number;
      current_material_id: number | null;
    }>(sql`
      UPDATE enrollments
         SET total_points             = total_points + ${earned},
             completed_material_count = completed_material_count + 1,
             current_material_id      = ${next?.id ?? materialId},
             max_sequence_reached     = GREATEST(max_sequence_reached,
                                                 ${next?.sequence_index ?? outer.material.sequenceIndex}),
             last_activity_at         = now()
       WHERE id = ${enrollment.id}
      RETURNING total_points, completed_material_count, current_material_id
    `)) as unknown as {
      total_points: number;
      completed_material_count: number;
      current_material_id: number | null;
    }[];

    // 6. Akumulasi lintas event untuk badge navbar (§2.2) — transaksi yang sama.
    await tx.execute(sql`
      UPDATE users SET total_points = total_points + ${earned}, updated_at = now()
       WHERE id = ${user.id}
    `);

    const updated = updatedRows[0];

    return {
      materialId,
      pointsEarned: earned,
      pointsAvailable,
      awarded: earned > 0,
      reason: (hasAnswer ? 'ANSWER_PRESENT' : 'NO_ANSWER_RESPONSE') as ScoringReason,
      enrollment: {
        totalPoints: updated.total_points,
        completedMaterialCount: updated.completed_material_count,
        progressPercent: progressPercent(
          updated.completed_material_count,
          outer.enrollment.materialCount,
        ),
        currentMaterialId: updated.current_material_id,
      },
      nextMaterialId: next?.id ?? null,
      isLast,
    };
  });
}
