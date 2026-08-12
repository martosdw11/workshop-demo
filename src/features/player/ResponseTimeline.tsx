'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { RESPONSE_TAB_LABELS, type ResponseItemData, type ResponseType } from './types';

/**
 * ResponseItem — TDD §6.6: avatar inisial, nama, waktu relatif.
 *
 * TIDAK ADA tombol like/reply (A-10) — mockup memilikinya, tapi keduanya di luar
 * §3 PRD. Sesuai A-10 tombolnya **dihapus**, bukan di-disable.
 *
 * `responses.content` adalah PLAIN TEXT dan tidak pernah dirender sebagai HTML
 * (§8.4) — di sini ia masuk sebagai text node biasa, dengan `whitespace-pre-wrap`
 * agar baris baru yang diketik peserta tetap terlihat.
 */
export function ResponseItem({ item }: { item: ResponseItemData }) {
  const isOptimistic = item.id < 0;

  return (
    <li className="flex gap-4">
      <Avatar className="mt-1 shrink-0">
        <AvatarFallback>{item.author.initials}</AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest p-4',
          isOptimistic && 'opacity-60',
        )}
        aria-busy={isOptimistic ? 'true' : undefined}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-title-md text-on-surface">{item.author.name}</span>
          <span className="flex items-center gap-2">
            {item.type === 'issue' && item.issueStatus && (
              <Badge variant={item.issueStatus === 'open' ? 'pending' : 'completed'}>
                {item.issueStatus === 'open' ? 'Open' : 'Resolved'}
              </Badge>
            )}
            <span className="text-label-sm text-on-surface-variant">
              {isOptimistic ? 'Mengirim…' : formatRelativeTime(item.createdAt)}
            </span>
          </span>
        </div>
        <p className="whitespace-pre-wrap text-body-md text-on-surface-variant">{item.content}</p>
      </div>
    </li>
  );
}

type ResponsePage = { items: ResponseItemData[]; nextCursor: string | null };

/**
 * ResponseTimeline — TDD §6.6: infinite scroll 20 item per halaman
 * (`PAGE_SIZE.responses`), keyset cursor dari §3.1.
 */
export function ResponseTimeline({
  materialId,
  type,
}: {
  materialId: number;
  type: ResponseType;
}) {
  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: qk.player.responses(materialId, type),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) => {
        const response = await apiFetchWithMeta<{ items: ResponseItemData[] }>(
          `/materials/${materialId}/responses`,
          { query: { type, cursor: pageParam ?? undefined, limit: PAGE_SIZE.responses } },
        );
        const nextCursor = response.meta?.nextCursor;
        return {
          items: response.data.items,
          nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
        } satisfies ResponsePage;
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  const items = React.useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  if (isPending) return <ListSkeleton count={3} />;
  if (error && items.length === 0) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="forum"
        title={`Belum ada ${RESPONSE_TAB_LABELS[type]}`}
        description="Jadilah yang pertama mengirim respons pada materi ini."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <ResponseItem key={item.id} item={item} />
        ))}
      </ul>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Memuat…' : 'Muat respons lama'}
          </Button>
        </div>
      )}
    </>
  );
}
