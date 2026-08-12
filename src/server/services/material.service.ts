import { and, asc, eq, sql } from 'drizzle-orm';

import { renderMaterialContent } from '@/lib/sanitize-html';
import type {
  CreateMaterialInput,
  ReorderMaterialsInput,
  UpdateMaterialInput,
} from '@/lib/validation/material';

import { revalidateEvent } from '../cache/tags';
import { db, type DbExecutor } from '../db/client';
import { events, materialProgress, materials } from '../db/schema';
import { env } from '../env';
import { AppError } from '../http/errors';

/**
 * Business logic kurikulum — TDD §3.4, §4.6 (EPIC 3 story 3.2).
 *
 * Dua invariant yang dijaga lapisan ini:
 *  1. `sequence_index` selalu merupakan urutan LINIER hasil flatten seluruh event
 *     (Modul 1 → Lesson 1.1 → 1.2 → Modul 2 …), dimulai dari 1.
 *  2. `events.material_count` dan `events.total_points` selalu cocok dengan isi
 *     tabel `materials` — keduanya dihitung ulang di TRANSAKSI YANG SAMA setiap
 *     kurikulum disimpan atau di-reorder (§2.4).
 */

type MaterialRow = typeof materials.$inferSelect;

export type MaterialNode = {
  id: number;
  eventId: number;
  parentId: number | null;
  depth: number;
  title: string;
  points: number;
  orderIndex: number;
  sequenceIndex: number;
  contentJson: unknown;
  contentHtml: string | null;
  children: MaterialNode[];
};

export type CurriculumSummary = { materialCount: number; totalPoints: number };

function toNode(row: MaterialRow): MaterialNode {
  return {
    id: row.id,
    eventId: row.eventId,
    parentId: row.parentId,
    depth: row.depth,
    title: row.title,
    points: row.points,
    orderIndex: row.orderIndex,
    sequenceIndex: row.sequenceIndex,
    contentJson: row.contentJson,
    contentHtml: row.contentHtml,
    children: [],
  };
}

/** Tree 2 level, diurutkan `sequence_index` (index #8). */
export function buildTree(rows: MaterialRow[]): MaterialNode[] {
  const nodes = new Map<number, MaterialNode>();
  const roots: MaterialNode[] = [];

  const sorted = [...rows].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  for (const row of sorted) nodes.set(row.id, toNode(row));

  for (const row of sorted) {
    const node = nodes.get(row.id);
    if (!node) continue;
    if (row.parentId === null) {
      roots.push(node);
    } else {
      nodes.get(row.parentId)?.children.push(node);
    }
  }
  return roots;
}

export async function getEventTree(
  eventId: number,
): Promise<{ tree: MaterialNode[] } & CurriculumSummary> {
  const [event] = await db
    .select({ materialCount: events.materialCount, totalPoints: events.totalPoints })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError('EVENT_NOT_FOUND');

  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.eventId, eventId))
    .orderBy(asc(materials.sequenceIndex));

  return {
    tree: buildTree(rows),
    materialCount: event.materialCount,
    totalPoints: event.totalPoints,
  };
}

type FlatRow = { id: number; parentId: number | null; orderIndex: number };

/**
 * Flatten kurikulum menjadi urutan linier. Ini yang membuat Next/Previous di
 * Learning Player cukup satu baris query (§2.4) alih-alih recursive CTE.
 */
function flattenCurriculum(
  rows: FlatRow[],
): { id: number; parentId: number | null; orderIndex: number; sequenceIndex: number }[] {
  const byOrder = (a: FlatRow, b: FlatRow) => a.orderIndex - b.orderIndex || a.id - b.id;

  const roots = rows.filter((row) => row.parentId === null).sort(byOrder);
  const childrenOf = new Map<number, FlatRow[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    const bucket = childrenOf.get(row.parentId);
    if (bucket) bucket.push(row);
    else childrenOf.set(row.parentId, [row]);
  }

  const out: { id: number; parentId: number | null; orderIndex: number; sequenceIndex: number }[] =
    [];
  let sequence = 1;

  roots.forEach((root, rootIndex) => {
    out.push({ id: root.id, parentId: null, orderIndex: rootIndex, sequenceIndex: sequence });
    sequence += 1;
    const children = (childrenOf.get(root.id) ?? []).sort(byOrder);
    children.forEach((child, childIndex) => {
      out.push({
        id: child.id,
        parentId: root.id,
        orderIndex: childIndex,
        sequenceIndex: sequence,
      });
      sequence += 1;
    });
  });

  return out;
}

/**
 * Rekalkulasi `order_index`, `sequence_index`, `material_count`, `total_points` —
 * SATU TRANSAKSI (§3.4 story 3.2).
 *
 * Dilakukan dalam TIGA statement, bukan satu, karena dua alasan yang keduanya
 * berasal dari constraint database:
 *  - `UNIQUE (event_id, sequence_index)` akan gagal di tengah penomoran ulang bila
 *    nilai baru ditulis langsung; karena itu nomor ditulis NEGATIF dulu lalu
 *    dibalik (kolom ini memang tidak punya CHECK non-negatif).
 *  - trigger `materials_set_depth` membaca `depth` induk SAAT ITU JUGA; menulis
 *    ulang seluruh `parent_id` dalam satu statement bisa membaca depth lama dan
 *    melanggar `CHECK depth IN (0,1)`. Karena itu semua baris dijadikan root dulu
 *    (depth 0), baru anak-anaknya dipasang kembali.
 */
async function recomputeCurriculum(tx: DbExecutor, eventId: number): Promise<CurriculumSummary> {
  const rows = await tx
    .select({
      id: materials.id,
      parentId: materials.parentId,
      orderIndex: materials.orderIndex,
    })
    .from(materials)
    .where(eq(materials.eventId, eventId));

  const flat = flattenCurriculum(rows);

  if (flat.length > 0) {
    const values = sql.join(
      flat.map(
        (item) => sql`(${item.id}::bigint, ${item.orderIndex}::int, ${item.sequenceIndex}::int)`,
      ),
      sql`, `,
    );

    // 1. semua baris jadi root sementara + nomor urut negatif
    await tx.execute(sql`
      UPDATE materials AS m
         SET parent_id      = NULL,
             order_index    = v.order_index,
             sequence_index = -v.sequence_index,
             updated_at     = now()
        FROM (VALUES ${values}) AS v(id, order_index, sequence_index)
       WHERE m.id = v.id AND m.event_id = ${eventId}
    `);

    // 2. pasang kembali relasi induk-anak (trigger mengisi depth = 1)
    const children = flat.filter((item) => item.parentId !== null);
    if (children.length > 0) {
      const childValues = sql.join(
        children.map((item) => sql`(${item.id}::bigint, ${item.parentId}::bigint)`),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE materials AS m
           SET parent_id = v.parent_id
          FROM (VALUES ${childValues}) AS v(id, parent_id)
         WHERE m.id = v.id AND m.event_id = ${eventId}
      `);
    }

    // 3. balik nomor urut menjadi positif
    await tx.execute(sql`
      UPDATE materials
         SET sequence_index = -sequence_index
       WHERE event_id = ${eventId} AND sequence_index < 0
    `);
  }

  const [summary] = (await tx.execute<{ material_count: number; total_points: number }>(sql`
    UPDATE events e
       SET material_count = agg.material_count,
           total_points   = agg.total_points,
           updated_at     = now()
      FROM (
        SELECT count(*)::int AS material_count,
               coalesce(sum(points), 0)::int AS total_points
          FROM materials WHERE event_id = ${eventId}
      ) AS agg
     WHERE e.id = ${eventId}
    RETURNING e.material_count, e.total_points
  `)) as unknown as { material_count: number; total_points: number }[];

  return {
    materialCount: summary?.material_count ?? 0,
    totalPoints: summary?.total_points ?? 0,
  };
}

/**
 * Mengunci baris event sebelum setiap mutasi kurikulum.
 * Urutan lock dibakukan `events` → `enrollments` → `material_progress` → `users`
 * (§4.3); menyentuh `events` lebih dulu menjaga urutan itu sekaligus
 * menyerialkan dua admin yang menyunting kurikulum event yang sama.
 */
async function lockEvent(tx: DbExecutor, eventId: number): Promise<void> {
  const rows = (await tx.execute<{ id: number }>(sql`
    SELECT id FROM events WHERE id = ${eventId} FOR UPDATE
  `)) as unknown as { id: number }[];
  if (!rows[0]) throw new AppError('EVENT_NOT_FOUND');
}

function sanitizeOptions() {
  return { mediaPublicHost: env.MEDIA_PUBLIC_HOST };
}

export async function createMaterial(
  eventId: number,
  input: CreateMaterialInput,
): Promise<{ material: MaterialNode; summary: CurriculumSummary }> {
  const rendered = renderMaterialContent(input.contentJson, sanitizeOptions());

  const result = await db.transaction(async (tx) => {
    await lockEvent(tx, eventId);

    if (input.parentId !== null) {
      const [parent] = await tx
        .select({ id: materials.id, depth: materials.depth, eventId: materials.eventId })
        .from(materials)
        .where(eq(materials.id, input.parentId))
        .limit(1);

      if (!parent || parent.eventId !== eventId) throw new AppError('MATERIAL_NOT_FOUND');
      // Batas 2 level: sub-materi tidak boleh punya sub-materi (§2.4, §9.2).
      if (parent.depth !== 0) throw new AppError('MAX_DEPTH_EXCEEDED');
    }

    // Nilai sementara; keduanya dinormalisasi ulang oleh `recomputeCurriculum`.
    const [nextOrder] = (await tx.execute<{ next_order: number }>(sql`
      SELECT coalesce(max(order_index) + 1, 0)::int AS next_order
        FROM materials
       WHERE event_id = ${eventId}
         AND parent_id IS NOT DISTINCT FROM ${input.parentId}
    `)) as unknown as { next_order: number }[];

    const [maxSeq] = (await tx.execute<{ next_sequence: number }>(sql`
      SELECT coalesce(max(sequence_index) + 1, 1)::int AS next_sequence
        FROM materials WHERE event_id = ${eventId}
    `)) as unknown as { next_sequence: number }[];

    const [inserted] = await tx
      .insert(materials)
      .values({
        eventId,
        parentId: input.parentId,
        title: input.title,
        contentJson: rendered.contentJson,
        contentHtml: rendered.contentHtml,
        points: input.points,
        orderIndex: nextOrder?.next_order ?? 0,
        sequenceIndex: maxSeq?.next_sequence ?? 1,
      })
      .returning();

    const summary = await recomputeCurriculum(tx, eventId);

    const [fresh] = await tx
      .select()
      .from(materials)
      .where(eq(materials.id, inserted.id))
      .limit(1);

    return { material: toNode(fresh), summary };
  });

  revalidateEvent(eventId);
  return result;
}

export async function updateMaterial(
  materialId: number,
  input: UpdateMaterialInput,
): Promise<{ material: MaterialNode; summary: CurriculumSummary }> {
  const [existing] = await db
    .select({ id: materials.id, eventId: materials.eventId })
    .from(materials)
    .where(eq(materials.id, materialId))
    .limit(1);

  if (!existing) throw new AppError('MATERIAL_NOT_FOUND');

  /**
   * TIDAK ADA guard progres di sini — §4.6 secara eksplisit MENGIZINKAN mengubah
   * materi (termasuk `points`) pada event yang sedang berjalan; perubahan itu
   * hanya berlaku untuk peserta berikutnya, dan `material_progress.points_earned`
   * yang sudah tercatat tidak ikut berubah (asumsi A-B06).
   */
  const rendered =
    input.contentJson !== undefined
      ? renderMaterialContent(input.contentJson, sanitizeOptions())
      : null;

  const result = await db.transaction(async (tx) => {
    await lockEvent(tx, existing.eventId);

    await tx
      .update(materials)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.points !== undefined ? { points: input.points } : {}),
        ...(rendered
          ? { contentJson: rendered.contentJson, contentHtml: rendered.contentHtml }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(materials.id, materialId));

    const summary = await recomputeCurriculum(tx, existing.eventId);
    const [fresh] = await tx.select().from(materials).where(eq(materials.id, materialId)).limit(1);
    return { material: toNode(fresh), summary };
  });

  revalidateEvent(existing.eventId);
  return result;
}

/** `DELETE /admin/materials/:id` — `409 MATERIAL_HAS_PROGRESS` (§4.6). */
export async function deleteMaterial(materialId: number): Promise<void> {
  const [existing] = await db
    .select({ id: materials.id, eventId: materials.eventId })
    .from(materials)
    .where(eq(materials.id, materialId))
    .limit(1);

  if (!existing) throw new AppError('MATERIAL_NOT_FOUND');

  await db.transaction(async (tx) => {
    await lockEvent(tx, existing.eventId);

    // Sub-materi ikut terhapus lewat CASCADE, jadi progres MEREKA juga harus ikut
    // diperiksa — bukan hanya progres materi ini.
    const blocking = (await tx.execute<{ id: number }>(sql`
      SELECT mp.id
        FROM material_progress mp
       WHERE mp.material_id = ${materialId}
          OR mp.material_id IN (SELECT id FROM materials WHERE parent_id = ${materialId})
       LIMIT 1
    `)) as unknown as { id: number }[];

    if (blocking[0]) throw new AppError('MATERIAL_HAS_PROGRESS');

    await tx.delete(materials).where(eq(materials.id, materialId));
    await recomputeCurriculum(tx, existing.eventId);
  });

  revalidateEvent(existing.eventId);
}

/**
 * `PATCH /admin/events/:id/materials/reorder` — SATU request untuk seluruh tree
 * (§6.7), bukan satu request per item.
 *
 * `409 STALE_TREE` bila daftar yang dikirim tidak lagi cocok dengan isi database
 * (materi ditambah/dihapus di tab lain). Deteksinya perbandingan himpunan id,
 * bukan versi/etag, sehingga tidak butuh kolom tambahan.
 */
export async function reorderMaterials(
  eventId: number,
  input: ReorderMaterialsInput,
): Promise<{ tree: MaterialNode[] } & CurriculumSummary> {
  await db.transaction(async (tx) => {
    await lockEvent(tx, eventId);

    const current = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(eq(materials.eventId, eventId));

    const currentIds = new Set(current.map((row) => row.id));
    const incomingIds = new Set(input.items.map((item) => item.id));

    const sameSize = currentIds.size === incomingIds.size;
    const sameMembers = [...incomingIds].every((id) => currentIds.has(id));
    if (!sameSize || !sameMembers) throw new AppError('STALE_TREE');

    // Batas 2 level diperiksa pada BENTUK yang dikirim, sebelum menyentuh database:
    // sebuah item tidak boleh menjadi induk bila ia sendiri punya induk.
    const parentOf = new Map(input.items.map((item) => [item.id, item.parentId]));
    for (const item of input.items) {
      if (item.parentId === null) continue;
      if (!incomingIds.has(item.parentId)) throw new AppError('STALE_TREE');
      if (item.parentId === item.id) throw new AppError('MAX_DEPTH_EXCEEDED');
      if (parentOf.get(item.parentId) !== null) throw new AppError('MAX_DEPTH_EXCEEDED');
    }

    // Tulis susunan yang diminta, lalu normalisasi ulang seluruh penomoran.
    const values = sql.join(
      input.items.map(
        (item) => sql`(${item.id}::bigint, ${item.parentId}::bigint, ${item.orderIndex}::int)`,
      ),
      sql`, `,
    );

    await tx.execute(sql`
      UPDATE materials AS m
         SET parent_id = NULL, order_index = v.order_index, updated_at = now()
        FROM (VALUES ${values}) AS v(id, parent_id, order_index)
       WHERE m.id = v.id AND m.event_id = ${eventId}
    `);
    await tx.execute(sql`
      UPDATE materials AS m
         SET parent_id = v.parent_id
        FROM (VALUES ${values}) AS v(id, parent_id, order_index)
       WHERE m.id = v.id AND m.event_id = ${eventId} AND v.parent_id IS NOT NULL
    `);

    await recomputeCurriculum(tx, eventId);
  });

  revalidateEvent(eventId);
  return getEventTree(eventId);
}

/** Dipakai `POST /events/:id/enroll` untuk menentukan materi pertama (§4.2). */
export async function getFirstMaterialId(
  tx: DbExecutor,
  eventId: number,
): Promise<number | null> {
  const [row] = await tx
    .select({ id: materials.id })
    .from(materials)
    .where(and(eq(materials.eventId, eventId), eq(materials.sequenceIndex, 1)))
    .limit(1);
  return row?.id ?? null;
}

/** Dipakai test & diagnostik: apakah materi ini punya progres peserta. */
export async function materialHasProgress(materialId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: materialProgress.id })
    .from(materialProgress)
    .where(eq(materialProgress.materialId, materialId))
    .limit(1);
  return Boolean(row);
}
