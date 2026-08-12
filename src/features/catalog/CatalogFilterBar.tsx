'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Input } from '@/components/ui/input';
import { EVENT_CATALOG_FILTERS, type EventCatalogFilter } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * CatalogFilterBar — TDD §6.5: filter status All/Active/Upcoming/Finished +
 * pencarian, **disinkronkan ke URL search params**.
 *
 * URL sengaja dijadikan satu-satunya sumber kebenaran filter: halaman 1 katalog
 * dirender di server dari `searchParams` (§1.2), jadi state lokal yang terpisah
 * akan segera melenceng dari apa yang server render. Ketikan pencarian
 * di-debounce 300 ms supaya tiap huruf tidak menjadi satu navigasi.
 */
const LABELS: Record<EventCatalogFilter, string> = {
  all: 'All',
  active: 'Active',
  upcoming: 'Upcoming',
  finished: 'Finished',
};

export function CatalogFilterBar({
  status,
  query,
}: {
  status: EventCatalogFilter;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftQuery, setDraftQuery] = React.useState(query);

  // URL bisa berubah dari luar (tombol back, tautan) — kotak pencarian ikut.
  React.useEffect(() => setDraftQuery(query), [query]);

  const pushParams = React.useCallback(
    (next: { status?: EventCatalogFilter; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.status !== undefined) {
        if (next.status === 'all') params.delete('status');
        else params.set('status', next.status);
      }
      if (next.q !== undefined) {
        if (next.q.trim() === '') params.delete('q');
        else params.set('q', next.q.trim());
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (draftQuery === query) return;
    const timer = setTimeout(() => pushParams({ q: draftQuery }), 300);
    return () => clearTimeout(timer);
  }, [draftQuery, query, pushParams]);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="mb-2 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          Event Catalog
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Temukan dan ikuti event pembelajaran untuk menambah keterampilan Anda.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:items-end">
        <div className="relative w-full md:w-64">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <MaterialIcon name="search" className="text-[20px] text-outline" />
          </span>
          <Input
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Cari event…"
            aria-label="Cari event"
            className="pl-10"
          />
        </div>

        <div
          role="group"
          aria-label="Filter status event"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-label-sm uppercase text-outline">Filter by Status:</span>
          {EVENT_CATALOG_FILTERS.map((filter) => {
            const isActive = filter === status;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => pushParams({ status: filter })}
                className={cn(
                  'min-h-11 rounded-full px-4 py-2 text-label-sm transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'border border-outline-variant bg-surface-container-high text-on-surface-variant hover:bg-surface-variant',
                )}
              >
                {LABELS[filter]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
