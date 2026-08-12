import 'dotenv/config';

import { count, eq } from 'drizzle-orm';

import { hashPassword } from '../auth/password';
import { env } from '../env';
import { closeDb, db } from './client';
import { enrollments, events, materialProgress, materials, responses, users } from './schema';

/**
 * Seed development — TDD §2.11.
 *
 * Isi: 1 admin (dari env), 3 peserta dummy, 2 event published, 1 event draft.
 * Masing-masing event published berisi 3 modul × 2 lesson agar epic berikutnya
 * (Auth, Katalog, Learning Player) bisa langsung dites tanpa data kosong.
 *
 * SIFAT: idempoten — aman dijalankan berulang. Baris yang sudah ada dilewati.
 * KEAMANAN: password admin di-hash Argon2id (PRD §7.8), tidak pernah plaintext.
 * PENJAGA: menolak jalan bila NODE_ENV === 'production'.
 */

if (env.NODE_ENV === 'production') {
  console.error('✖ Seed dilarang dijalankan di production (TDD §2.11).');
  process.exit(1);
}

/** Password peserta dummy — hanya untuk development. */
const PARTICIPANT_PASSWORD = 'Peserta12345';

const PARTICIPANTS = [
  { name: 'Andi Pratama', email: 'andi@example.com', phone: '+628123450001' },
  { name: 'Bunga Lestari', email: 'bunga@example.com', phone: '+628123450002' },
  { name: 'Citra Handayani', email: 'citra@example.com', phone: '+628123450003' },
];

/** Kurikulum: 3 modul, masing-masing 2 lesson (TDD §2.11). */
const CURRICULUM = [
  {
    title: 'Modul 1 — Fondasi Machine Learning',
    points: 20,
    lessons: [
      { title: 'Lesson 1.1 — Supervised vs Unsupervised', points: 30 },
      { title: 'Lesson 1.2 — Kualitas & Label Data', points: 30 },
    ],
  },
  {
    title: 'Modul 2 — Model & Evaluasi',
    points: 20,
    lessons: [
      { title: 'Lesson 2.1 — Overfitting dan Regularisasi', points: 30 },
      { title: 'Lesson 2.2 — Metrik Evaluasi Model', points: 30 },
    ],
  },
  {
    title: 'Modul 3 — Penerapan di Organisasi',
    points: 20,
    lessons: [
      { title: 'Lesson 3.1 — Studi Kasus Internal', points: 30 },
      { title: 'Lesson 3.2 — Rencana Adopsi Bertahap', points: 30 },
    ],
  },
];

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/** Konten placeholder yang sudah aman (analog hasil sanitasi §8.4). */
function contentFor(title: string) {
  const html = `<p>Materi <strong>${title}</strong> masih berupa konten contoh untuk keperluan development.</p><ul><li>Poin pembahasan pertama</li><li>Poin pembahasan kedua</li></ul>`;
  const json = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `Materi ${title} — konten contoh untuk development.` }],
      },
    ],
  };
  return { html, json };
}

async function seedAdmin() {
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi di .env untuk membuat admin pertama.',
    );
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log(`  · admin ${email} sudah ada — dilewati`);
    return existing[0].id;
  }

  const [admin] = await db
    .insert(users)
    .values({
      name: env.SEED_ADMIN_NAME,
      email,
      phone: env.SEED_ADMIN_PHONE,
      passwordHash: await hashPassword(password), // Argon2id — tidak pernah plaintext
      role: 'admin',
      status: 'active',
    })
    .returning({ id: users.id });

  console.log(`  ✔ admin dibuat: ${email}`);
  return admin.id;
}

async function seedParticipants() {
  const passwordHash = await hashPassword(PARTICIPANT_PASSWORD);
  const ids: number[] = [];

  for (const p of PARTICIPANTS) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, p.email));
    if (existing.length > 0) {
      ids.push(existing[0].id);
      console.log(`  · peserta ${p.email} sudah ada — dilewati`);
      continue;
    }

    const [row] = await db
      .insert(users)
      .values({ ...p, passwordHash, role: 'participant', status: 'active' })
      .returning({ id: users.id });

    ids.push(row.id);
    console.log(`  ✔ peserta dibuat: ${p.email}`);
  }

  return ids;
}

type EventSeed = {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  quota: number | null;
  status: 'draft' | 'published';
  withCurriculum: boolean;
};

async function seedEvent(spec: EventSeed, adminId: number) {
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.title, spec.title));
  if (existing.length > 0) {
    console.log(`  · event "${spec.title}" sudah ada — dilewati`);
    return;
  }

  await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        title: spec.title,
        description: spec.description,
        startAt: spec.startAt,
        endAt: spec.endAt,
        quota: spec.quota,
        status: spec.status,
        createdBy: adminId,
        publishedAt: spec.status === 'published' ? new Date() : null,
      })
      .returning({ id: events.id });

    if (!spec.withCurriculum) {
      console.log(`  ✔ event "${spec.title}" dibuat (${spec.status}, tanpa materi)`);
      return;
    }

    // sequence_index = urutan LINIER hasil flatten (Modul 1 → 1.1 → 1.2 → Modul 2 …),
    // dipakai Next/Previous dan penentuan lock di Learning Player (TDD §2.4).
    let sequenceIndex = 0;
    let materialCount = 0;
    let totalPoints = 0;

    for (const [moduleIndex, mod] of CURRICULUM.entries()) {
      const modContent = contentFor(mod.title);
      sequenceIndex += 1;

      const [moduleRow] = await tx
        .insert(materials)
        .values({
          eventId: event.id,
          parentId: null, // depth diisi trigger materials_set_depth_trg
          title: mod.title,
          contentJson: modContent.json,
          contentHtml: modContent.html,
          points: mod.points,
          orderIndex: moduleIndex,
          sequenceIndex,
        })
        .returning({ id: materials.id });

      materialCount += 1;
      totalPoints += mod.points;

      for (const [lessonIndex, lesson] of mod.lessons.entries()) {
        const lessonContent = contentFor(lesson.title);
        sequenceIndex += 1;

        await tx.insert(materials).values({
          eventId: event.id,
          parentId: moduleRow.id,
          title: lesson.title,
          contentJson: lessonContent.json,
          contentHtml: lessonContent.html,
          points: lesson.points,
          orderIndex: lessonIndex,
          sequenceIndex,
        });

        materialCount += 1;
        totalPoints += lesson.points;
      }
    }

    // Denormalisasi kartu katalog & guard Finish (TDD §2.3, §4.5)
    await tx.update(events).set({ materialCount, totalPoints }).where(eq(events.id, event.id));

    console.log(
      `  ✔ event "${spec.title}" dibuat (${spec.status}, ${materialCount} materi, ${totalPoints} poin)`,
    );
  });
}

async function main() {
  console.log(`▶ Seed database (NODE_ENV=${env.NODE_ENV})`);

  console.log('\n[1/3] Users');
  const adminId = await seedAdmin();
  await seedParticipants();

  console.log('\n[2/3] Events + kurikulum');
  await seedEvent(
    {
      title: 'Advanced Machine Learning',
      description: 'Pelatihan machine learning terapan untuk tim data internal.',
      startAt: days(-2), // sedang berjalan → muncul di filter "Active"
      endAt: days(28),
      quota: 150,
      status: 'published',
      withCurriculum: true,
    },
    adminId,
  );

  await seedEvent(
    {
      title: 'Data Storytelling untuk Manajer',
      description: 'Menyusun narasi berbasis data untuk pengambilan keputusan.',
      startAt: days(7), // belum mulai → muncul di filter "Upcoming"
      endAt: days(21),
      quota: null, // tanpa batas kuota
      status: 'published',
      withCurriculum: true,
    },
    adminId,
  );

  await seedEvent(
    {
      title: '[Draft] Fundamental Prompt Engineering',
      description: 'Masih disusun — tidak boleh muncul di katalog peserta.',
      startAt: days(30),
      endAt: days(45),
      quota: 100,
      status: 'draft',
      withCurriculum: false,
    },
    adminId,
  );

  console.log('\n[3/3] Ringkasan');
  const [[u], [e], [m], [en], [mp], [r]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(events),
    db.select({ n: count() }).from(materials),
    db.select({ n: count() }).from(enrollments),
    db.select({ n: count() }).from(materialProgress),
    db.select({ n: count() }).from(responses),
  ]);

  console.table({
    users: u.n,
    events: e.n,
    materials: m.n,
    enrollments: en.n,
    material_progress: mp.n,
    responses: r.n,
  });
  console.log('\n✔ Seed selesai.');
  console.log(`  Login admin   : ${env.SEED_ADMIN_EMAIL} / (SEED_ADMIN_PASSWORD di .env)`);
  console.log(`  Login peserta : andi@example.com / ${PARTICIPANT_PASSWORD}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('✖ Seed gagal:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
