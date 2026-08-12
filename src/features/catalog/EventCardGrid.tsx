'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { CardGridSkeleton } from '@/components/shared/LoadingSkeletons';
import { Button } from '@/components/ui/button';
import { apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE, type EventCatalogFilter } from '@/lib/constants';
import { qk } from '@/lib/query-keys';
import { EventCard } from './EventCard';
import { JoinConfirmDialog } from './JoinConfirmDialog';
import type { CatalogPage, EventCardData } from './types';

/**
 * EventCardGrid — TDD §6.5.
 *
 * Bento 3 kolom desktop. **Halaman 1 dirender server** (§1.2) dan dipakai
 * sebagai `initialData` TanStack Query, sehingga tidak ada request duplikat saat
 * halaman pertama kali dibuka; halaman berikutnya diambil lewat cursor.
 *
 * Infinite scroll memakai `IntersectionObserver` dengan tombol "Muat lebih
 * banyak" sebagai sentinel — bukan div kosong. Alasannya aksesibilitas: pengguna
 * keyboard tidak bisa memicu scroll-observer, tapi bisa menekan tombol.
 */
export type EventCardGridProps = {
  status: EventCatalogFilter;
  query: string;
  initialItems: EventCardData[];
  initialNextCursor: string | null;
};

export function EventCardGrid({
  status,
  query,
  initialItems,
  initialNextCursor,
}: EventCardGridProps) {
  const [joinTarget, setJoinTarget] = React.useState<EventCardData | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const { data, error, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isPending } =
    useInfiniteQuery({
      queryKey: qk.events.list({ status, q: query }),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) => {
        const response = await apiFetchWithMeta<{ items: EventCardData[] }>('/events', {
          query: {
            status,
            q: query || undefined,
            cursor: pageParam ?? undefined,
            limit: PAGE_SIZE.catalog,
          },
        });
        const nextCursor = response.meta?.nextCursor;
        return {
          items: response.data.items,
          nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
        } satisfies CatalogPage;
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialData: {
        pages: [{ items: initialItems, nextCursor: initialNextCursor }],
        pageParams: [null],
      },
    });

  const items = React.useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openJoin = (event: EventCardData) => {
    setJoinTarget(event);
    setDialogOpen(true);
  };

  if (isPending) return <CardGridSkeleton />;

  if (error && items.length === 0) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="event_busy"
        title="Belum ada event yang cocok"
        description={
          query
            ? `Tidak ada event yang cocok dengan pencarian "${query}". Coba kata kunci lain atau ubah filter status.`
            : 'Belum ada event pada filter ini. Coba pilih status lain.'
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {items.map((event) => (
          <EventCard key={event.id} event={event} onJoin={openJoin} />
        ))}
      </div>

      <div ref={sentinelRef} className="mt-8 flex justify-center">
        {hasNextPage && (
          <Button
            variant="secondary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
          </Button>
        )}
      </div>

      {/* Pengumuman async untuk pembaca layar (§6.10). */}
      <p aria-live="polite" className="sr-only">
        {isFetchingNextPage ? 'Memuat event berikutnya' : `${items.length} event ditampilkan`}
      </p>

      <JoinConfirmDialog event={joinTarget} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
