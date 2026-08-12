import 'dotenv/config';

import { eq } from 'drizzle-orm';

import { hashPassword } from '../auth/password';
import { env } from '../env';
import { closeDb, db } from './client';
import { enrollments, events, materialProgress, materials, responses, users } from './schema';

/**
 * Seed volume — TDD §2.11 & §11.4.
 *
 * Membuat 1 event dengan 20 materi + 150 peserta beserta progres acak, untuk
 * memeriksa halaman monitoring & matriks nilai pada ukuran data realistis.
 * Bukan uji beban — tujuannya memastikan query agregat (§7.2) tetap di bawah
 * 20 ms dan halaman termuat < 2 detik pada volume target.
 *
 * Angka acuan yang dihasilkan: ± 3.000 baris material_progress, ± 6.000 responses.
 */

if (env.NODE_ENV === 'production') {
  console.error('✖ seed:bulk dilarang dijalankan di production.');
  process.exit(1);
}

const EVENT_TITLE = '[Bulk] Corporate AI Bootcamp';
const PARTICIPANT_COUNT = 150;
const MODULE_COUNT = 5;
const LESSONS_PER_MODULE = 3; // 5 modul + 15 lesson = 20 materi
const BULK_PASSWORD = 'Peserta12345';

/** PRNG deterministik — hasil seed dapat direproduksi antar-jalankan. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const random = makeRandom(20260812);
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const RESPONSE_TEXT = [
  'Menurut saya perbedaan utamanya ada pada ketersediaan label data.',
  'Bagian ini masih perlu contoh konkret dari kasus internal kami.',
  'Materi tersampaikan jelas, terutama pada bagian evaluasi model.',
  'Saya belum berhasil menjalankan contoh yang diberikan di section ini.',
] as const;

async function main() {
  console.log(`▶ Seed volume: ${PARTICIPANT_COUNT} peserta × 20 materi`);

  const existingEvent = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.title, EVENT_TITLE));

  if (existingEvent.length > 0) {
    console.log(`  · event "${EVENT_TITLE}" sudah ada — jalankan \`npm run db:reset\` dulu.`);
    return;
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  if (!admin) {
    throw new Error('Belum ada admin. Jalankan `npm run db:seed` terlebih dahulu.');
  }

  // Satu hash dipakai ulang untuk seluruh peserta bulk: menghitung Argon2id
  // 150× akan memakan puluhan detik tanpa menambah nilai untuk uji volume.
  console.log('  · hashing password…');
  const passwordHash = await hashPassword(BULK_PASSWORD);

  console.log('  · membuat event + 20 materi…');
  const { eventId, materialRows } = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        title: EVENT_TITLE,
        description: 'Data volume untuk smoke test dashboard admin & matriks nilai.',
        startAt: daysAgo(14),
        endAt: daysAgo(-14),
        quota: 200,
        status: 'published',
        createdBy: admin.id,
        publishedAt: daysAgo(14),
      })
      .returning({ id: events.id });

    const rows: { id: number; points: number; sequenceIndex: number }[] = [];
    let sequenceIndex = 0;
    let totalPoints = 0;

    for (let m = 0; m < MODULE_COUNT; m += 1) {
      sequenceIndex += 1;
      const [moduleRow] = await tx
        .insert(materials)
        .values({
          eventId: event.id,
          parentId: null,
          title: `Modul ${m + 1}`,
          contentHtml: `<p>Konten modul ${m + 1}.</p>`,
          points: 20,
          orderIndex: m,
          sequenceIndex,
        })
        .returning({ id: materials.id });

      rows.push({ id: moduleRow.id, points: 20, sequenceIndex });
      totalPoints += 20;

      for (let l = 0; l < LESSONS_PER_MODULE; l += 1) {
        sequenceIndex += 1;
        const [lessonRow] = await tx
          .insert(materials)
          .values({
            eventId: event.id,
            parentId: moduleRow.id,
            title: `Lesson ${m + 1}.${l + 1}`,
            contentHtml: `<p>Konten lesson ${m + 1}.${l + 1}.</p>`,
            points: 30,
            orderIndex: l,
            sequenceIndex,
          })
          .returning({ id: materials.id });

        rows.push({ id: lessonRow.id, points: 30, sequenceIndex });
        totalPoints += 30;
      }
    }

    await tx
      .update(events)
      .set({ materialCount: rows.length, totalPoints, enrolledCount: PARTICIPANT_COUNT })
      .where(eq(events.id, event.id));

    return { eventId: event.id, materialRows: rows };
  });

  console.log('  · membuat 150 peserta + progres acak…');
  let progressRows = 0;
  let responseRows = 0;

  for (let i = 0; i < PARTICIPANT_COUNT; i += 1) {
    const index = String(i + 1).padStart(3, '0');

    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: `Peserta Bulk ${index}`,
          email: `bulk${index}@example.com`,
          phone: `+62812${index}0000`,
          passwordHash,
          role: 'participant',
          status: 'active',
        })
        .returning({ id: users.id });

      // Sebaran posisi: sebagian selesai, sebagian di tengah, sebagian stalled.
      const completedCount = Math.floor(random() * (materialRows.length + 1));
      const isCompleted = completedCount === materialRows.length;
      const current = materialRows[Math.min(completedCount, materialRows.length - 1)];

      /*
       * Garis waktu aktivitas dibuat MONOTON MAJU dan seluruhnya berada di antara
       * `joined_at` dan `completed_at`. Ini bukan kosmetik: query assert integritas
       * (TDD §11.4 no. 4) menolak adanya respons yang dibuat setelah enrollment
       * `completed`, sehingga data sintetis pun harus mematuhi aturan penguncian.
       *
       * 20% peserta diberi garis waktu yang berhenti belasan hari lalu agar
       * terklasifikasi "Stalled" (`last_activity_at` > 3 hari, TDD §7.5).
       */
      const isStalled = random() < 0.2;
      const baseAgeDays = isStalled ? 12 : 2.5;
      const stepDays = 0.1; // ± 2,4 jam antar aktivitas
      const activityAt = (k: number) => daysAgo(baseAgeDays - k * stepDays);
      const joinedAt = daysAgo(baseAgeDays + 1);
      // Aktivitas terakhir; bila belum ada materi selesai, jatuh ke waktu join.
      const lastActivity = completedCount > 0 ? activityAt(completedCount - 1) : joinedAt;
      // Finish terjadi SETELAH respons terakhir (setengah langkah sesudahnya).
      const completedAt = daysAgo(baseAgeDays - (completedCount - 1 + 0.5) * stepDays);

      const [enrollment] = await tx
        .insert(enrollments)
        .values({
          eventId,
          userId: user.id,
          status: isCompleted ? 'completed' : 'in_progress',
          currentMaterialId: current.id,
          maxSequenceReached: current.sequenceIndex,
          completedMaterialCount: completedCount,
          totalPoints: 0,
          joinedAt,
          lastActivityAt: isCompleted ? completedAt : lastActivity,
          completedAt: isCompleted ? completedAt : null,
        })
        .returning({ id: enrollments.id });

      let earnedTotal = 0;

      for (let k = 0; k < completedCount; k += 1) {
        const material = materialRows[k];
        // Poin all-or-nothing: hanya diberikan bila peserta mengirim `answer` (§4.1)
        const hasAnswer = random() < 0.75;
        const earned = hasAnswer ? material.points : 0;
        earnedTotal += earned;

        if (hasAnswer) {
          await tx.insert(responses).values({
            enrollmentId: enrollment.id,
            materialId: material.id,
            userId: user.id,
            type: 'answer',
            content: pick(RESPONSE_TEXT),
            createdAt: activityAt(k),
          });
          responseRows += 1;
        }

        if (random() < 0.25) {
          const isIssue = random() < 0.4;
          await tx.insert(responses).values({
            enrollmentId: enrollment.id,
            materialId: material.id,
            userId: user.id,
            type: isIssue ? 'issue' : 'comment',
            content: pick(RESPONSE_TEXT),
            issueStatus: isIssue ? (random() < 0.7 ? 'open' : 'resolved') : null,
            createdAt: activityAt(k),
          });
          responseRows += 1;
        }

        await tx.insert(materialProgress).values({
          enrollmentId: enrollment.id,
          materialId: material.id,
          status: 'completed',
          pointsEarned: earned,
          completedAt: activityAt(k),
        });
        progressRows += 1;
      }

      await tx
        .update(enrollments)
        .set({ totalPoints: earnedTotal })
        .where(eq(enrollments.id, enrollment.id));
      await tx.update(users).set({ totalPoints: earnedTotal }).where(eq(users.id, user.id));
    });

    if ((i + 1) % 25 === 0) console.log(`    … ${i + 1}/${PARTICIPANT_COUNT} peserta`);
  }

  console.log(
    `\n✔ Seed volume selesai: 1 event, ${materialRows.length} materi, ${PARTICIPANT_COUNT} peserta, ` +
      `${progressRows} material_progress, ${responseRows} responses.`,
  );
  console.log('  Lanjut: buka dashboard admin & drill-down, pastikan tidak ada query > 200 ms.');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('✖ Seed volume gagal:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
