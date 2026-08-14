import { and, desc, eq, ilike, lt } from 'drizzle-orm';

import type { AdminEventQuery, CreateEventInput, UpdateEventInput } from '@/lib/validation/event';

import { revalidateEvent, revalidateEventList } from '../cache/tags';
import { db } from '../db/client';
import { enrollments, events } from '../db/schema';
import type { EventStatus } from '../db/schema/enums';
import { AppError } from '../http/errors';
import { decodeCursor, idCursorSchema, sliceWithCursor } from '../http/pagination';
import { getEventTree, type MaterialNode } from './material.service';

/**
 * Business logic event — TDD §3.4 (EPIC 3 story 3.1).
 * Satu-satunya lapisan yang menulis ke tabel `events` (§1.3).
 */

type EventRow = typeof events.$inferSelect;

export type AdminEvent = {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startAt: string;
  endAt: string;
  quota: number | null;
  status: EventStatus;
  enrolledCount: number;
  materialCount: number;
  totalPoints: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toAdminEvent(row: EventRow): AdminEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.coverUrl,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    quota: row.quota,
    status: row.status,
    enrolledCount: row.enrolledCount,
    materialCount: row.materialCount,
    totalPoints: row.totalPoints,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findEventOrThrow(eventId: number): Promise<EventRow> {
  const [row] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!row) throw new AppError('EVENT_NOT_FOUND');
  return row;
}

/** `GET /admin/events` — cursor `id DESC` (event terbaru lebih dulu). */
export async function listAdminEvents(
  query: AdminEventQuery,
): Promise<{ items: AdminEvent[]; nextCursor: string | null }> {
  const cursor = decodeCursor(query.cursor, idCursorSchema);

  const conditions = [
    query.status === 'all' ? undefined : eq(events.status, query.status),
    query.q ? ilike(events.title, `%${query.q}%`) : undefined,
    cursor ? lt(events.id, cursor.id) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.id))
    .limit(query.limit + 1);

  const page = sliceWithCursor(rows, query.limit, (row) => ({ id: row.id }));
  return { items: page.items.map(toAdminEvent), nextCursor: page.nextCursor };
}

/** `GET /admin/events/:id` → `{event, materials:[MaterialTree]}`. */
export async function getAdminEventDetail(
  eventId: number,
): Promise<{ event: AdminEvent; materials: MaterialNode[] }> {
  const row = await findEventOrThrow(eventId);
  const { tree } = await getEventTree(eventId);
  return { event: toAdminEvent(row), materials: tree };
}

export async function createEvent(
  input: CreateEventInput,
  createdBy: number,
): Promise<AdminEvent> {
  const [row] = await db
    .insert(events)
    .values({
      title: input.title,
      description: input.description,
      coverUrl: input.coverUrl,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      quota: input.quota,
      status: 'draft',
      createdBy,
    })
    .returning();

  revalidateEventList();
  return toAdminEvent(row);
}

/**
 * `PATCH /admin/events/:id`.
 *
 * ASUMSI EKSPLISIT (A-B05): §3.4 menyebut `403 EVENT_PUBLISHED_IMMUTABLE_FIELD`
 * tanpa mendefinisikan field mana. Ditetapkan di sini:
 *  - jadwal (`startAt` dan `endAt`) tidak dapat diubah setelah event `published` —
 *    katalog memfilter Active/Upcoming/Finished berdasarkan kolom ini (§3.3) dan
 *    peserta sudah melihatnya;
 *  - `quota` tidak boleh diturunkan di bawah `enrolled_count`, karena itu akan
 *    membuat event "lebih dari penuh" dan menyalahi invariant §4.2.
 * Field lain (judul, deskripsi, cover, kuota) tetap boleh diubah kapan saja.
 */
export async function updateEvent(
  eventId: number,
  input: UpdateEventInput,
): Promise<AdminEvent> {
  const current = await findEventOrThrow(eventId);

  if (current.status === 'published') {
    if (input.startAt !== undefined && new Date(input.startAt).getTime() !== current.startAt.getTime()) {
      throw new AppError('EVENT_PUBLISHED_IMMUTABLE_FIELD', { field: 'startAt' });
    }
    if (input.endAt !== undefined && new Date(input.endAt).getTime() !== current.endAt.getTime()) {
      throw new AppError('EVENT_PUBLISHED_IMMUTABLE_FIELD', { field: 'endAt' });
    }
    if (input.quota !== undefined && input.quota !== null && input.quota < current.enrolledCount) {
      throw new AppError('EVENT_PUBLISHED_IMMUTABLE_FIELD', {
        field: 'quota',
        enrolledCount: current.enrolledCount,
      });
    }
  }

  // Jadwal divalidasi silang terhadap nilai yang TERSIMPAN, bukan hanya terhadap
  // field yang ikut dikirim — PATCH parsial bisa membalik urutan tanpa disadari.
  const nextStart = input.startAt ? new Date(input.startAt) : current.startAt;
  const nextEnd = input.endAt ? new Date(input.endAt) : current.endAt;
  if (nextEnd <= nextStart) {
    throw new AppError('VALIDATION_ERROR', {
      fields: { endAt: 'Tanggal selesai harus setelah tanggal mulai.' },
    });
  }

  const [row] = await db
    .update(events)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      ...(input.startAt !== undefined ? { startAt: nextStart } : {}),
      ...(input.endAt !== undefined ? { endAt: nextEnd } : {}),
      ...(input.quota !== undefined ? { quota: input.quota } : {}),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning();

  revalidateEvent(eventId);
  return toAdminEvent(row);
}

/** `DELETE /admin/events/:id` — `409 EVENT_HAS_ENROLLMENTS`. */
export async function deleteEvent(eventId: number): Promise<void> {
  await findEventOrThrow(eventId);

  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.eventId, eventId))
    .limit(1);

  if (existing) throw new AppError('EVENT_HAS_ENROLLMENTS');

  // Materi ikut terhapus lewat `ON DELETE CASCADE` (§2.4).
  await db.delete(events).where(eq(events.id, eventId));
  revalidateEvent(eventId);
}

/**
 * `POST /admin/events/:id/publish` — dua arah (§3.4).
 * Guard: `422 EVENT_HAS_NO_MATERIAL` saat publish tanpa materi.
 *
 * Kembali ke draft DIPERBOLEHKAN walau sudah ada peserta: enrollment yang ada
 * tidak disentuh sama sekali (peserta lama tetap bisa melanjutkan lewat katalog
 * mereka), event hanya berhenti menerima peserta baru dan hilang dari katalog
 * peserta yang belum bergabung.
 */
export async function setEventPublishStatus(
  eventId: number,
  status: 'published' | 'draft',
): Promise<AdminEvent> {
  const current = await findEventOrThrow(eventId);

  if (status === 'published' && current.materialCount < 1) {
    throw new AppError('EVENT_HAS_NO_MATERIAL');
  }

  const [row] = await db
    .update(events)
    .set({
      status,
      // `published_at` menandai publikasi PERTAMA dan tidak ditulis ulang.
      ...(status === 'published' && current.publishedAt === null
        ? { publishedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning();

  revalidateEvent(eventId);
  return toAdminEvent(row);
}
