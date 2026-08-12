import { randomInt } from 'node:crypto';

import { sql } from 'drizzle-orm';

import type { ParticipantQuery } from '@/lib/validation/user';

import { assertNotSelf } from '../auth/guard';
import { hashPassword } from '../auth/password';
import { revokeAllSessionsForUser, type SessionUser } from '../auth/session';
import { db } from '../db/client';
import type { EnrollmentStatus, ResponseType, UserRole, UserStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';
import { decodeCursor, sliceWithCursor, idCursorSchema } from '../http/pagination';
import { progressPercent } from './catalog.service';
import { initialsOf } from './response.service';

/**
 * Participant List, Detail Peserta & User Access — TDD §3.4 (EPIC 7 story 7.2–7.3).
 */

export type PersonRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  total_points: number;
  created_at: Date;
  events_joined: number;
};

export type PersonItem = {
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    initials: string;
    createdAt: string;
  };
  eventsJoined: number;
  totalPoints: number;
  status: UserStatus;
};

function toPersonItem(row: PersonRow): PersonItem {
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      initials: initialsOf(row.name),
      createdAt: new Date(row.created_at).toISOString(),
    },
    eventsJoined: row.events_joined,
    totalPoints: row.total_points,
    status: row.status,
  };
}

/**
 * `GET /admin/participants` — §3.4.
 *
 * ASUMSI EKSPLISIT (A-B10): ini SATU-SATUNYA endpoint daftar orang di §3.4,
 * sementara EPIC 7 story 7.3 (User Access) juga perlu melihat dan menurunkan
 * admin. Karena itu ia mengembalikan SELURUH user beserta `role`, bukan hanya
 * `role='participant'`; bentuk payload §3.4 tidak berubah. Menyaring ke peserta
 * saja akan membuat admin yang baru dipromosikan hilang dari daftar sehingga
 * tidak bisa diturunkan kembali.
 *
 * Berjalan di atas index #2 `(role, status)` untuk filter, dan `eventsJoined`
 * dihitung dari `enrollments` lewat index #4.
 */
export async function listPeople(
  query: ParticipantQuery,
): Promise<{ items: PersonItem[]; nextCursor: string | null }> {
  const cursor = decodeCursor(query.cursor, idCursorSchema);

  const rows = (await db.execute<PersonRow>(sql`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.total_points, u.created_at,
           (SELECT count(*)::int FROM enrollments en WHERE en.user_id = u.id) AS events_joined
      FROM users u
     WHERE (${query.status === 'all' ? null : query.status}::text IS NULL
            OR u.status = ${query.status === 'all' ? null : query.status}::user_status)
       AND (${query.q ?? null}::text IS NULL
            OR u.name ILIKE '%' || ${query.q ?? null}::text || '%'
            OR u.email::text ILIKE '%' || ${query.q ?? null}::text || '%')
       AND (${cursor?.id ?? null}::bigint IS NULL OR u.id > ${cursor?.id ?? null}::bigint)
     ORDER BY u.id
     LIMIT ${query.limit + 1}
  `)) as unknown as PersonRow[];

  const page = sliceWithCursor(rows, query.limit, (row) => ({ id: row.id }));
  return { items: page.items.map(toPersonItem), nextCursor: page.nextCursor };
}

export type ParticipantDetail = {
  profile: PersonItem['user'] & { status: UserStatus; totalPoints: number };
  enrollments: {
    enrollmentId: number;
    event: { id: number; title: string; startAt: string; endAt: string };
    status: EnrollmentStatus;
    points: number;
    pointsAvailable: number;
    progress: number;
    joinedAt: string;
    completedAt: string | null;
  }[];
};

/** `GET /admin/participants/:userId` — §3.4. `404 USER_NOT_FOUND`. */
export async function getParticipantDetail(userId: number): Promise<ParticipantDetail> {
  const userRows = (await db.execute<PersonRow>(sql`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.total_points, u.created_at,
           (SELECT count(*)::int FROM enrollments en WHERE en.user_id = u.id) AS events_joined
      FROM users u WHERE u.id = ${userId}
  `)) as unknown as PersonRow[];

  const row = userRows[0];
  if (!row) throw new AppError('USER_NOT_FOUND');

  const enrollmentRows = (await db.execute<{
    enrollment_id: number;
    event_id: number;
    title: string;
    start_at: Date;
    end_at: Date;
    status: EnrollmentStatus;
    total_points: number;
    event_total_points: number;
    completed_material_count: number;
    material_count: number;
    joined_at: Date;
    completed_at: Date | null;
  }>(sql`
    SELECT en.id AS enrollment_id, ev.id AS event_id, ev.title, ev.start_at, ev.end_at,
           en.status, en.total_points, ev.total_points AS event_total_points,
           en.completed_material_count, ev.material_count, en.joined_at, en.completed_at
      FROM enrollments en JOIN events ev ON ev.id = en.event_id
     WHERE en.user_id = ${userId}
     ORDER BY en.joined_at DESC
  `)) as unknown as {
    enrollment_id: number;
    event_id: number;
    title: string;
    start_at: Date;
    end_at: Date;
    status: EnrollmentStatus;
    total_points: number;
    event_total_points: number;
    completed_material_count: number;
    material_count: number;
    joined_at: Date;
    completed_at: Date | null;
  }[];

  const item = toPersonItem(row);

  return {
    profile: { ...item.user, status: row.status, totalPoints: row.total_points },
    enrollments: enrollmentRows.map((en) => ({
      enrollmentId: en.enrollment_id,
      event: {
        id: en.event_id,
        title: en.title,
        startAt: new Date(en.start_at).toISOString(),
        endAt: new Date(en.end_at).toISOString(),
      },
      status: en.status,
      points: en.total_points,
      pointsAvailable: en.event_total_points,
      progress: progressPercent(en.completed_material_count, en.material_count),
      joinedAt: new Date(en.joined_at).toISOString(),
      completedAt: en.completed_at ? new Date(en.completed_at).toISOString() : null,
    })),
  };
}

export type ParticipantEventDrilldown = {
  perMaterialPoints: {
    materialId: number;
    title: string;
    depth: number;
    sequenceIndex: number;
    pointsAvailable: number;
    pointsEarned: number | null;
    completedAt: string | null;
  }[];
  responses: {
    id: number;
    materialId: number;
    materialTitle: string;
    type: ResponseType;
    content: string;
    issueStatus: 'open' | 'resolved' | null;
    createdAt: string;
  }[];
};

/**
 * `GET /admin/participants/:userId/events/:eventId` — §3.4.
 * Rincian poin tiap materi + seluruh respons peserta di event tersebut
 * (index #12 `(enrollment_id, created_at DESC)`).
 */
export async function getParticipantEventDrilldown(
  userId: number,
  eventId: number,
): Promise<ParticipantEventDrilldown> {
  const enrollmentRows = (await db.execute<{ id: number }>(sql`
    SELECT id FROM enrollments WHERE user_id = ${userId} AND event_id = ${eventId}
  `)) as unknown as { id: number }[];

  const enrollment = enrollmentRows[0];
  if (!enrollment) throw new AppError('NOT_FOUND');

  const materialRows = (await db.execute<{
    material_id: number;
    title: string;
    depth: number;
    sequence_index: number;
    points: number;
    points_earned: number | null;
    completed_at: Date | null;
  }>(sql`
    SELECT m.id AS material_id, m.title, m.depth, m.sequence_index, m.points,
           mp.points_earned, mp.completed_at
      FROM materials m
      LEFT JOIN material_progress mp
        ON mp.material_id = m.id AND mp.enrollment_id = ${enrollment.id}
     WHERE m.event_id = ${eventId}
     ORDER BY m.sequence_index
  `)) as unknown as {
    material_id: number;
    title: string;
    depth: number;
    sequence_index: number;
    points: number;
    points_earned: number | null;
    completed_at: Date | null;
  }[];

  const responseRows = (await db.execute<{
    id: number;
    material_id: number;
    material_title: string;
    type: ResponseType;
    content: string;
    issue_status: 'open' | 'resolved' | null;
    created_at: Date;
  }>(sql`
    SELECT r.id, r.material_id, m.title AS material_title, r.type, r.content,
           r.issue_status, r.created_at
      FROM responses r JOIN materials m ON m.id = r.material_id
     WHERE r.enrollment_id = ${enrollment.id}
     ORDER BY r.created_at DESC
  `)) as unknown as {
    id: number;
    material_id: number;
    material_title: string;
    type: ResponseType;
    content: string;
    issue_status: 'open' | 'resolved' | null;
    created_at: Date;
  }[];

  return {
    perMaterialPoints: materialRows.map((row) => ({
      materialId: row.material_id,
      title: row.title,
      depth: row.depth,
      sequenceIndex: row.sequence_index,
      pointsAvailable: row.points,
      pointsEarned: row.points_earned,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    })),
    responses: responseRows.map((row) => ({
      id: row.id,
      materialId: row.material_id,
      materialTitle: row.material_title,
      type: row.type,
      content: row.content,
      issueStatus: row.issue_status,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

export type PublicUserRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  total_points: number;
};

function toUserPayload(row: PublicUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    totalPoints: row.total_points,
  };
}

/**
 * `PATCH /admin/users/:id/role` — §3.4.
 * `403 CANNOT_DEMOTE_SELF` · `409 LAST_ADMIN`.
 *
 * Guard `LAST_ADMIN` dijalankan DI DALAM transaksi setelah baris user dikunci,
 * supaya dua admin yang saling menurunkan pada saat bersamaan tidak bisa
 * menghasilkan sistem tanpa admin sama sekali.
 */
export async function updateUserRole(
  targetUserId: number,
  role: UserRole,
  actor: SessionUser,
): Promise<ReturnType<typeof toUserPayload>> {
  assertNotSelf(targetUserId, actor, 'CANNOT_DEMOTE_SELF');

  return db.transaction(async (tx) => {
    const currentRows = (await tx.execute<PublicUserRow>(sql`
      SELECT id, name, email, phone, role, status, total_points
        FROM users WHERE id = ${targetUserId} FOR UPDATE
    `)) as unknown as PublicUserRow[];

    const current = currentRows[0];
    if (!current) throw new AppError('USER_NOT_FOUND');

    if (current.role === 'admin' && role === 'participant') {
      const remaining = (await tx.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM users
         WHERE role = 'admin' AND status = 'active' AND id <> ${targetUserId}
      `)) as unknown as { n: number }[];

      if ((remaining[0]?.n ?? 0) < 1) throw new AppError('LAST_ADMIN');
    }

    const updated = (await tx.execute<PublicUserRow>(sql`
      UPDATE users SET role = ${role}::user_role, updated_at = now()
       WHERE id = ${targetUserId}
      RETURNING id, name, email, phone, role, status, total_points
    `)) as unknown as PublicUserRow[];

    return toUserPayload(updated[0]);
  });
}

/**
 * `PATCH /admin/users/:id/status` — §3.4, §5.3.
 *
 * Menonaktifkan akun memicu `DELETE FROM sessions WHERE user_id = …` PADA
 * TRANSAKSI YANG SAMA: akun nonaktif tidak boleh masih punya tab terbuka yang
 * berfungsi. Kalau revoke dijalankan terpisah, ada jendela waktu — sekecil apa
 * pun — di mana akun sudah nonaktif tapi sesinya masih hidup.
 */
export async function updateUserStatus(
  targetUserId: number,
  status: UserStatus,
  actor: SessionUser,
): Promise<ReturnType<typeof toUserPayload>> {
  if (status === 'inactive') assertNotSelf(targetUserId, actor, 'CANNOT_DEACTIVATE_SELF');

  return db.transaction(async (tx) => {
    const currentRows = (await tx.execute<PublicUserRow>(sql`
      SELECT id, name, email, phone, role, status, total_points
        FROM users WHERE id = ${targetUserId} FOR UPDATE
    `)) as unknown as PublicUserRow[];

    const current = currentRows[0];
    if (!current) throw new AppError('USER_NOT_FOUND');

    // Menonaktifkan admin terakhir juga menghilangkan admin aktif dari sistem.
    if (status === 'inactive' && current.role === 'admin') {
      const remaining = (await tx.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM users
         WHERE role = 'admin' AND status = 'active' AND id <> ${targetUserId}
      `)) as unknown as { n: number }[];

      if ((remaining[0]?.n ?? 0) < 1) throw new AppError('LAST_ADMIN');
    }

    const updated = (await tx.execute<PublicUserRow>(sql`
      UPDATE users SET status = ${status}::user_status, updated_at = now()
       WHERE id = ${targetUserId}
      RETURNING id, name, email, phone, role, status, total_points
    `)) as unknown as PublicUserRow[];

    if (status === 'inactive') await revokeAllSessionsForUser(targetUserId, tx);

    return toUserPayload(updated[0]);
  });
}

/**
 * Password sementara: 16 karakter dari alfabet tanpa karakter ambigu
 * (`0/O`, `1/l/I`), dijamin memuat huruf DAN angka sehingga lolos `passwordSchema`
 * saat peserta memakainya untuk login (§9.2). Dibangkitkan dengan `randomInt`
 * dari `node:crypto`, bukan `Math.random`.
 */
const SAFE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SAFE_DIGITS = '23456789';

function generateTemporaryPassword(): string {
  const alphabet = SAFE_LETTERS + SAFE_DIGITS;
  const chars = [
    SAFE_LETTERS[randomInt(SAFE_LETTERS.length)],
    SAFE_DIGITS[randomInt(SAFE_DIGITS.length)],
  ];
  while (chars.length < 16) chars.push(alphabet[randomInt(alphabet.length)]);

  // Fisher-Yates agar posisi huruf/angka wajib tidak selalu di depan.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * `POST /admin/users/:id/reset-password` — §3.4, asumsi A-09.
 *
 * Password sementara ditampilkan SEKALI di UI; tidak ada email (out of scope
 * MVP). Seluruh sesi user dicabut di transaksi yang sama — kalau tidak, pemilik
 * sesi lama tetap bisa memakai akun yang passwordnya baru saja direset.
 *
 * Nilai password TIDAK PERNAH masuk log (daftar `redact` di `http/logger.ts`).
 */
export async function resetUserPassword(targetUserId: number): Promise<{
  temporaryPassword: string;
}> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db.transaction(async (tx) => {
    const updated = (await tx.execute<{ id: number }>(sql`
      UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
       WHERE id = ${targetUserId}
      RETURNING id
    `)) as unknown as { id: number }[];

    if (!updated[0]) throw new AppError('USER_NOT_FOUND');

    await revokeAllSessionsForUser(targetUserId, tx);
  });

  return { temporaryPassword };
}
