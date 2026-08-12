'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ErrorState } from '@/components/shared/ErrorState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Pagination, useCursorPagination } from '@/components/shared/Pagination';
import { StatusPill } from '@/components/shared/StatusPill';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { apiFetchWithMeta } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { ParticipantSearchBar } from './ParticipantSearchBar';
import type { ParticipantRow } from './types';

/**
 * ParticipantTable — TDD §6.9, acuan `admin_participant_list/`.
 *
 * Kolom persis mockup: checkbox, Participant (avatar + nama + email),
 * Phone Number, Events Joined, Total Points, Status, Action.
 *
 * Seleksi baris disimpan lokal (state `selected`). MVP tidak punya aksi massal
 * di §3 PRD, jadi checkbox berhenti sebagai penanda pilihan — sengaja TIDAK
 * ditambahkan tombol "hapus terpilih" yang tak ada di kontrak.
 */
export function ParticipantTable({
  initialItems,
  initialNextCursor,
  q,
  status,
  rowsPerPage,
}: {
  initialItems: ParticipantRow[];
  initialNextCursor: string | null;
  q: string;
  status: string;
  rowsPerPage: number;
}) {
  const pagination = useCursorPagination();
  const [selected, setSelected] = React.useState<Array<string | number>>([]);
  const [limit, setLimit] = React.useState(rowsPerPage);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: [...qk.admin.participants.list({ q, status }), pagination.cursor, limit],
    queryFn: async () => {
      const response = await apiFetchWithMeta<{ items: ParticipantRow[] }>('/admin/participants', {
        query: { q: q || undefined, status, cursor: pagination.cursor ?? undefined, limit },
      });
      const nextCursor = response.meta?.nextCursor;
      return {
        items: response.data.items,
        nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
      };
    },
    initialData:
      pagination.pageIndex === 0 && limit === rowsPerPage
        ? { items: initialItems, nextCursor: initialNextCursor }
        : undefined,
  });

  const columns: Array<DataTableColumn<ParticipantRow>> = [
    {
      id: 'participant',
      header: 'Participant',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{row.user.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-title-md text-on-surface">{row.user.name}</p>
            <p className="truncate text-label-sm text-on-surface-variant">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    { id: 'phone', header: 'Phone Number', cell: (row) => row.user.phone },
    {
      id: 'events',
      header: 'Events Joined',
      cell: (row) => formatNumber(row.eventsJoined),
    },
    {
      id: 'points',
      header: 'Total Points',
      cell: (row) => (
        <span className="flex items-center gap-1 text-label-md text-on-surface">
          <MaterialIcon name="stars" filled className="text-[16px] text-tertiary-fixed-dim" />
          {formatNumber(row.totalPoints)}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusPill variant={row.status} /> },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <Link
          href={`/admin/participants/${row.user.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          Detail
          <MaterialIcon name="chevron_right" />
        </Link>
      ),
    },
  ];

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <ParticipantSearchBar q={q} status={status} onParamsChange={pagination.reset} />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.user.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        isLoading={isFetching && !data}
        emptyTitle="Tidak ada peserta"
        emptyDescription="Ubah kata kunci pencarian atau filter status."
      />

      <Pagination
        rowsPerPage={limit}
        onRowsPerPageChange={(next) => {
          pagination.reset();
          setLimit(next);
        }}
        currentCount={data?.items.length ?? 0}
        pageIndex={pagination.pageIndex}
        hasNext={Boolean(data?.nextCursor)}
        hasPrevious={pagination.hasPrevious}
        onNext={() => pagination.goNext(data?.nextCursor ?? null)}
        onPrevious={pagination.goPrevious}
        isLoading={isFetching}
      />
    </div>
  );
}
