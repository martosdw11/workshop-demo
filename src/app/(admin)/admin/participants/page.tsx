import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { ParticipantTable } from '@/features/people/ParticipantTable';
import { PAGE_SIZE } from '@/lib/constants';
import { listPeople } from '@/server/services/user.service';

/** Participant List — PRD §3.B.9, acuan `admin_participant_list/`. */
export const metadata: Metadata = { title: 'Participant List — Learning Study AI' };
export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'active', 'inactive'] as const;
type ParticipantStatus = (typeof STATUSES)[number];

export default async function ParticipantListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const status: ParticipantStatus = STATUSES.includes(params.status as ParticipantStatus)
    ? (params.status as ParticipantStatus)
    : 'all';

  const firstPage = await listPeople({
    q: q || undefined,
    status,
    cursor: undefined,
    limit: PAGE_SIZE.participants,
  });

  return (
    <div className="px-container-mobile py-6 md:px-container-desktop">
      <div className="mb-6">
        <h1 className="mb-1 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          Participant List
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          Seluruh akun terdaftar beserta jumlah event dan poin yang dikumpulkan.
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ParticipantTable
          key={`${q}:${status}`}
          initialItems={firstPage.items}
          initialNextCursor={firstPage.nextCursor}
          q={q}
          status={status}
          rowsPerPage={PAGE_SIZE.participants}
        />
      </Suspense>
    </div>
  );
}
