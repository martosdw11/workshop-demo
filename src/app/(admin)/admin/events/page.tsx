import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { buttonVariants } from '@/components/ui/button';
import { EventManagementTable } from '@/features/builder/EventManagementTable';
import { PAGE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { listAdminEvents } from '@/server/services/event.service';

/** Event Management — daftar event + filter status + aksi (PRD §3.B). */
export const metadata: Metadata = { title: 'Event Management — Learning Study AI' };
export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'draft', 'published', 'finished'] as const;
type AdminEventStatus = (typeof STATUSES)[number];

export default async function EventManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status: AdminEventStatus = STATUSES.includes(params.status as AdminEventStatus)
    ? (params.status as AdminEventStatus)
    : 'all';
  const query = params.q?.trim() ?? '';

  const firstPage = await listAdminEvents({
    status,
    q: query || undefined,
    cursor: undefined,
    limit: PAGE_SIZE.adminEvents,
  });

  return (
    <div className="px-container-mobile py-6 md:px-container-desktop">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-headline-lg-mobile text-on-surface md:text-headline-lg">
            Event Management
          </h1>
          <p className="text-body-sm text-on-surface-variant">
            Kelola event, kurikulum, dan status publikasi.
          </p>
        </div>

        <Link href="/admin/events/new" className={cn(buttonVariants({ variant: 'primary' }))}>
          <MaterialIcon name="add" />
          Create Event
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <EventManagementTable
          key={`${status}:${query}`}
          initialItems={firstPage.items}
          initialNextCursor={firstPage.nextCursor}
          status={status}
          query={query}
        />
      </Suspense>
    </div>
  );
}
