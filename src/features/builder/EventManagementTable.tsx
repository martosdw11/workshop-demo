'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ErrorState } from '@/components/shared/ErrorState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Pagination, useCursorPagination } from '@/components/shared/Pagination';
import { StatusPill } from '@/components/shared/StatusPill';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { formatDateRange, formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { AdminEvent } from './types';

/**
 * Halaman Event Management — PRD §3.B (menu "Event Management").
 *
 * Filter status + pencarian disinkronkan ke URL search params, mengikuti pola
 * yang sama dengan katalog peserta: URL adalah sumber kebenaran filter.
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'finished', label: 'Finished' },
];

export function EventManagementTable({
  initialItems,
  initialNextCursor,
  status,
  query,
}: {
  initialItems: AdminEvent[];
  initialNextCursor: string | null;
  status: string;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftQuery, setDraftQuery] = React.useState(query);
  const pagination = useCursorPagination();

  React.useEffect(() => setDraftQuery(query), [query]);

  const pushParams = React.useCallback(
    (next: { status?: string; q?: string }) => {
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
    const timer = setTimeout(() => {
      pagination.reset();
      pushParams({ q: draftQuery });
    }, 300);
    return () => clearTimeout(timer);
    // `pagination` sengaja tidak masuk dependency: identitasnya berubah tiap
    // render dan akan me-reset debounce sebelum sempat berjalan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery, query, pushParams]);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: [...qk.admin.events.list({ status, q: query }), pagination.cursor],
    queryFn: async () => {
      const response = await apiFetchWithMeta<{ items: AdminEvent[] }>('/admin/events', {
        query: {
          status,
          q: query || undefined,
          cursor: pagination.cursor ?? undefined,
          limit: PAGE_SIZE.adminEvents,
        },
      });
      const nextCursor = response.meta?.nextCursor;
      return {
        items: response.data.items,
        nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
      };
    },
    initialData:
      pagination.pageIndex === 0
        ? { items: initialItems, nextCursor: initialNextCursor }
        : undefined,
  });

  const columns: Array<DataTableColumn<AdminEvent>> = [
    {
      id: 'title',
      header: 'Event',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-title-md text-on-surface">{row.title}</p>
          <p className="truncate text-label-sm text-on-surface-variant">
            {formatDateRange(row.startAt, row.endAt)}
          </p>
        </div>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusPill variant={row.status} /> },
    {
      id: 'materials',
      header: 'Materi',
      cell: (row) => formatNumber(row.materialCount),
    },
    { id: 'points', header: 'Total Poin', cell: (row) => formatNumber(row.totalPoints) },
    {
      id: 'participants',
      header: 'Peserta',
      cell: (row) =>
        row.quota
          ? `${formatNumber(row.enrolledCount)} / ${formatNumber(row.quota)}`
          : formatNumber(row.enrolledCount),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/events/${row.id}/edit`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            <MaterialIcon name="edit" />
            Edit
          </Link>
          <Link
            href={`/admin/events/${row.id}/participants`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <MaterialIcon name="group" />
            Peserta
          </Link>
        </div>
      ),
    },
  ];

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col gap-3 border-b border-outline-variant p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-64">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <MaterialIcon name="search" className="text-[20px] text-outline" />
          </span>
          <Input
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Cari judul event…"
            aria-label="Cari event"
            className="pl-10"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            pagination.reset();
            pushParams({ status: value });
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter status event">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isFetching && !data}
        emptyTitle="Belum ada event"
        emptyDescription="Buat event pertama Anda lewat tombol Create Event."
      />

      <Pagination
        rowsPerPage={PAGE_SIZE.adminEvents}
        currentCount={data?.items.length ?? 0}
        pageIndex={pagination.pageIndex}
        hasNext={Boolean(data?.nextCursor)}
        hasPrevious={pagination.hasPrevious}
        onNext={() => pagination.goNext(data?.nextCursor ?? null)}
        onPrevious={pagination.goPrevious}
        isLoading={isFetching}
      />

      <div className="sr-only" aria-live="polite">
        {isFetching ? 'Memuat daftar event' : `${data?.items.length ?? 0} event ditampilkan`}
      </div>
    </div>
  );
}
