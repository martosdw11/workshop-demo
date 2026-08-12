import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { EventDetailTabs } from '@/features/people/EventDetailTabs';
import { ScoreMatrixTable } from '@/features/people/ScoreMatrixTable';
import { isAppError } from '@/server/http/errors';
import { getAdminEventDetail } from '@/server/services/event.service';

/** Tab **Peserta & Nilai** — PRD §3.B.8, matriks peserta × materi. */
export const metadata: Metadata = { title: 'Peserta & Nilai — Learning Study AI' };
export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'in_progress', 'completed'] as const;

export default async function EventParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const query = await searchParams;
  const q = query.q?.trim() ?? '';
  const status = STATUSES.includes(query.status as (typeof STATUSES)[number])
    ? (query.status as string)
    : 'all';

  try {
    const detail = await getAdminEventDetail(eventId);

    return (
      <div className="px-container-mobile py-6 md:px-container-desktop">
        <h1 className="mb-4 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          {detail.event.title}
        </h1>

        <EventDetailTabs eventId={eventId} />

        <Suspense fallback={<TableSkeleton />}>
          <ScoreMatrixTable key={`${q}:${status}`} eventId={eventId} q={q} status={status} />
        </Suspense>
      </div>
    );
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
}
