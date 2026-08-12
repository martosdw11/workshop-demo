import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { CardGridSkeleton } from '@/components/shared/LoadingSkeletons';
import { CatalogFilterBar } from '@/features/catalog/CatalogFilterBar';
import { EventCardGrid } from '@/features/catalog/EventCardGrid';
import { EVENT_CATALOG_FILTERS, PAGE_SIZE, type EventCatalogFilter } from '@/lib/constants';
import { getCurrentUser } from '@/server/auth/rbac';
import { listCatalog } from '@/server/services/catalog.service';

/**
 * Event Catalog — PRD §3.A.3, acuan `event_catalog/`.
 *
 * Strategi render §1.2: Dynamic RSC. Halaman 1 diambil lewat service layer
 * (daftar event-nya sendiri di-cache 30 detik di dalam service; badge
 * keikutsertaan di-join per user di luar cache), lalu diserahkan ke
 * `EventCardGrid` sebagai `initialData` untuk infinite scroll berikutnya.
 */
export const metadata: Metadata = { title: 'Event Catalog — Learning Study AI' };
export const dynamic = 'force-dynamic';

function parseStatus(value: string | undefined): EventCatalogFilter {
  return EVENT_CATALOG_FILTERS.includes(value as EventCatalogFilter)
    ? (value as EventCatalogFilter)
    : 'all';
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = params.q?.trim() ?? '';

  const firstPage = await listCatalog(user.id, {
    status,
    q: query || undefined,
    cursor: undefined,
    limit: PAGE_SIZE.catalog,
  });

  return (
    <main className="mx-auto max-w-7xl px-container-mobile py-8 md:px-container-desktop">
      <div className="mb-8">
        <Suspense fallback={null}>
          <CatalogFilterBar status={status} query={query} />
        </Suspense>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <EventCardGrid
          // `key` memaksa remount saat filter berubah supaya `initialData`
          // halaman 1 yang baru benar-benar dipakai, bukan cache filter lama.
          key={`${status}:${query}`}
          status={status}
          query={query}
          initialItems={firstPage.items}
          initialNextCursor={firstPage.nextCursor}
        />
      </Suspense>
    </main>
  );
}
