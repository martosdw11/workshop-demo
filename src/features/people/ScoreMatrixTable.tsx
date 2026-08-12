'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Pagination, useCursorPagination } from '@/components/shared/Pagination';
import { StatusPill } from '@/components/shared/StatusPill';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { ParticipantSearchBar } from './ParticipantSearchBar';
import type { MatrixMaterialData, MatrixParticipantData } from './types';

/**
 * ScoreMatrixTable — TDD §6.9: matriks peserta × materi, **pagination 25
 * peserta** per halaman.
 *
 * Sengaja TANPA virtualisasi (§6.9): 25 × 20 = 500 sel per halaman jauh di
 * bawah ambang yang membebani browser. Yang wajib dijaga hanyalah paginationnya.
 *
 * Tabel ini lebar; ia menggulir horizontal di dalam wadahnya sendiri (kolom
 * peserta tetap terlihat lewat `sticky`), sehingga halaman tidak ikut bergeser.
 */
export function ScoreMatrixTable({
  eventId,
  q,
  status,
}: {
  eventId: number;
  q: string;
  status: string;
}) {
  const pagination = useCursorPagination();

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: [...qk.admin.events.participants(eventId, { q, status }), pagination.cursor],
    queryFn: async () => {
      const response = await apiFetchWithMeta<{
        items: MatrixParticipantData[];
        materials: MatrixMaterialData[];
      }>(`/admin/events/${eventId}/participants`, {
        query: {
          q: q || undefined,
          status,
          cursor: pagination.cursor ?? undefined,
          limit: PAGE_SIZE.eventParticipants,
        },
      });
      const nextCursor = response.meta?.nextCursor;
      return {
        items: response.data.items,
        materials: response.data.materials,
        nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
      };
    },
  });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <ParticipantSearchBar
        q={q}
        status={status}
        onParamsChange={pagination.reset}
        placeholder="Cari peserta di event ini…"
        statusOptions={[
          { value: 'all', label: 'Semua status' },
          { value: 'in_progress', label: 'Sedang diikuti' },
          { value: 'completed', label: 'Selesai' },
        ]}
      />

      {isPending ? (
        <TableSkeleton rows={6} columns={6} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Belum ada peserta"
          description="Peserta akan muncul di sini setelah bergabung ke event."
          className="m-4"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 bg-surface-container-lowest">
                Peserta
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Posisi terakhir</TableHead>
              {data.materials.map((material) => (
                <TableHead key={material.id} className="min-w-24">
                  <span className={cn('block truncate', material.depth === 1 && 'pl-2')}>
                    {material.title}
                  </span>
                  <span className="text-on-surface-variant">{material.points} pts</span>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.items.map((row) => {
              const byMaterial = new Map(row.perMaterial.map((item) => [item.materialId, item]));
              return (
                <TableRow key={row.enrollmentId}>
                  <TableCell className="sticky left-0 z-10 bg-surface-container-lowest">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{row.user.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-title-md text-on-surface">{row.user.name}</p>
                        <p className="truncate text-label-sm text-on-surface-variant">
                          {row.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <StatusPill
                      variant={row.status === 'completed' ? 'completed' : 'in-progress'}
                    />
                  </TableCell>

                  <TableCell className="max-w-40 truncate">
                    {row.currentMaterial?.title ?? '—'}
                  </TableCell>

                  {data.materials.map((material) => {
                    const cell = byMaterial.get(material.id);
                    return (
                      <TableCell key={material.id} className="text-center">
                        {cell?.completed ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-label-sm',
                              cell.pointsEarned > 0
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : 'bg-surface-container-high text-on-surface-variant',
                            )}
                          >
                            {cell.pointsEarned > 0 && (
                              <MaterialIcon name="star" filled className="text-[12px]" />
                            )}
                            {formatNumber(cell.pointsEarned)}
                          </span>
                        ) : (
                          <span className="text-outline">—</span>
                        )}
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-right text-title-md text-on-surface">
                    {formatNumber(row.totalPoints)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Pagination
        rowsPerPage={PAGE_SIZE.eventParticipants}
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
