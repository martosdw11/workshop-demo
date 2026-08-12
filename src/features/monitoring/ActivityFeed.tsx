'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { MONITORING_POLL_MS, type ActivityItemData } from './types';

/**
 * ActivityItem — TDD §6.8: ikon `chat_bubble` (komentar), `report_problem`
 * merah (issue), `task_alt` (selesai). Tiap item menaut ke materi terkait
 * (`href` sudah disiapkan server).
 *
 * ASUMSI EKSPLISIT (A-F03): `GET /admin/activity` mengembalikan `type` bernilai
 * `answer` | `comment` | `issue` — tidak ada tipe "event diselesaikan" di
 * kontrak §3.4. Ikon `task_alt` karena itu dipakai untuk respons **Jawaban**
 * (tanda peserta menyelesaikan tugas materi), bukan untuk penyelesaian event
 * yang memang tidak dikirim endpoint ini.
 */
const ICON_BY_TYPE: Record<ActivityItemData['type'], { icon: string; className: string }> = {
  answer: { icon: 'task_alt', className: 'bg-surface-container-high text-primary' },
  comment: { icon: 'chat_bubble', className: 'bg-surface-container-high text-on-surface-variant' },
  issue: { icon: 'report_problem', className: 'bg-error-container text-error' },
};

export function ActivityItem({ item }: { item: ActivityItemData }) {
  const config = ICON_BY_TYPE[item.type];

  return (
    <li>
      <Link
        href={item.href}
        className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', config.className)}>
          <MaterialIcon name={config.icon} filled />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-label-md text-on-surface">{item.user.name}</span>
            <span className="text-label-sm text-on-surface-variant">
              pada {item.materialTitle} · {formatRelativeTime(item.createdAt)}
            </span>
          </p>
          <p className="line-clamp-2 text-body-sm text-on-surface-variant">{item.content}</p>
        </div>
      </Link>
    </li>
  );
}

export function ActivityFeed({ eventId }: { eventId: number | null }) {
  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: qk.admin.dashboard.activity(eventId ?? undefined),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) => {
        const response = await apiFetchWithMeta<{ items: ActivityItemData[] }>('/admin/activity', {
          query: {
            eventId: eventId ?? undefined,
            cursor: pageParam ?? undefined,
            limit: PAGE_SIZE.activity,
          },
        });
        const nextCursor = response.meta?.nextCursor;
        return {
          items: response.data.items,
          nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
        };
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // Polling 30 detik hanya menyegarkan halaman pertama (§7.3).
      refetchInterval: MONITORING_POLL_MS,
    });

  const items = React.useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  return (
    <section
      aria-labelledby="activity-title"
      className="rounded-lg border border-outline-variant bg-surface-container-lowest"
    >
      <div className="border-b border-outline-variant p-4 md:p-6">
        <h2 id="activity-title" className="text-title-lg text-on-surface">
          Recent Activity
        </h2>
        <p className="text-body-sm text-on-surface-variant">
          Respons terbaru peserta, diperbarui otomatis tiap 30 detik.
        </p>
      </div>

      <div className="p-2">
        {isPending ? (
          <ListSkeleton count={4} />
        ) : error && items.length === 0 ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="Belum ada aktivitas"
            description="Aktivitas muncul setelah peserta mengirim jawaban, komentar, atau issue."
            className="m-2"
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {items.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </ul>

            {hasNextPage && (
              <div className="flex justify-center p-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
