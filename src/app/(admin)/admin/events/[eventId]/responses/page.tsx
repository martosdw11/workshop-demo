import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { EventDetailTabs } from '@/features/people/EventDetailTabs';
import { EventResponsesTable } from '@/features/people/EventResponsesTable';
import type { MatrixMaterialData } from '@/features/people/types';
import { requireAdmin } from '@/server/auth/rbac';
import { isAppError } from '@/server/http/errors';
import { getAdminEventDetail } from '@/server/services/event.service';
import { getEventTree } from '@/server/services/material.service';

/**
 * Tab **Respons** — PRD §3.B.8: agregasi seluruh Jawaban/Komentar/Issue,
 * dapat difilter per tipe & per materi, dengan aksi menandai issue `resolved`.
 *
 * Daftar materi untuk filter diambil dari tree (server), diratakan menjadi
 * daftar linier agar sub-materi ikut bisa dipilih.
 */
export const metadata: Metadata = { title: 'Respons Event — Learning Study AI' };
export const dynamic = 'force-dynamic';

const TYPES = ['all', 'answer', 'comment', 'issue'] as const;
const ISSUE_STATUSES = ['all', 'open', 'resolved'] as const;

export default async function EventResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ type?: string; materialId?: string; issueStatus?: string }>;
}) {
  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const query = await searchParams;
  const type = TYPES.includes(query.type as (typeof TYPES)[number]) ? (query.type as string) : 'all';
  const issueStatus = ISSUE_STATUSES.includes(query.issueStatus as (typeof ISSUE_STATUSES)[number])
    ? (query.issueStatus as string)
    : 'all';
  const parsedMaterialId = Number(query.materialId);
  const materialId =
    Number.isInteger(parsedMaterialId) && parsedMaterialId > 0 ? parsedMaterialId : null;

  try {
    // id admin dipakai FE menandai komentar thread milik sendiri (aksi edit).
    const admin = await requireAdmin();
    const [detail, tree] = await Promise.all([getAdminEventDetail(eventId), getEventTree(eventId)]);

    const materials: MatrixMaterialData[] = tree.tree.flatMap((module) => [
      {
        id: module.id,
        title: module.title,
        depth: module.depth,
        points: module.points,
        sequenceIndex: module.sequenceIndex,
      },
      ...module.children.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        depth: lesson.depth,
        points: lesson.points,
        sequenceIndex: lesson.sequenceIndex,
      })),
    ]);

    return (
      <div className="px-container-mobile py-6 md:px-container-desktop">
        <h1 className="mb-4 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          {detail.event.title}
        </h1>

        <EventDetailTabs eventId={eventId} />

        <Suspense fallback={<TableSkeleton />}>
          <EventResponsesTable
            key={`${type}:${materialId}:${issueStatus}`}
            eventId={eventId}
            materials={materials}
            type={type}
            materialId={materialId}
            issueStatus={issueStatus}
            adminUserId={admin.id}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
}
