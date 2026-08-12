import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EventBuilderShell } from '@/features/builder/EventBuilderShell';
import type { MaterialNode } from '@/features/builder/types';
import { getAdminEventDetail } from '@/server/services/event.service';
import { getEventTree } from '@/server/services/material.service';
import { isAppError } from '@/server/http/errors';
import { db } from '@/server/db/client';
import { sql } from 'drizzle-orm';

/**
 * Event Builder (edit) — PRD §3.B.7, acuan `event_builder_material_creator_fixed/`.
 *
 * Data awal dibaca lewat service layer (Server Component, A-03); seluruh mutasi
 * setelahnya lewat `/api/v1/admin/*` dari client, sesuai batas kontrak §3.
 */
export const metadata: Metadata = { title: 'Event Builder — Learning Study AI' };
export const dynamic = 'force-dynamic';

/**
 * Materi yang sudah dikerjakan peserta (§4.6). Dibaca di sini karena kontrak §3
 * tidak menyertakan flag ini pada `GET /admin/events/:id/materials`, sementara
 * UI perlu menampilkan peringatan "perubahan points hanya berlaku untuk peserta
 * berikutnya" pada materi yang tepat. Ini query BACA di Server Component lewat
 * `db` — bukan mutasi, bukan endpoint baru.
 */
async function lockedMaterialIdsFor(eventId: number): Promise<number[]> {
  const rows = (await db.execute<{ material_id: number }>(sql`
    SELECT DISTINCT mp.material_id
      FROM material_progress mp
      JOIN materials m ON m.id = mp.material_id
     WHERE m.event_id = ${eventId}
  `)) as unknown as { material_id: number }[];
  return rows.map((row) => row.material_id);
}

export default async function EventBuilderEditPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  try {
    const [detail, tree, lockedIds] = await Promise.all([
      getAdminEventDetail(eventId),
      getEventTree(eventId),
      lockedMaterialIdsFor(eventId),
    ]);

    return (
      <Suspense fallback={null}>
        <EventBuilderShell
          event={detail.event}
          initialTree={tree.tree as MaterialNode[]}
          lockedMaterialIds={lockedIds}
        />
      </Suspense>
    );
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
}
