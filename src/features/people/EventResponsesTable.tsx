'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Pagination, useCursorPagination } from '@/components/shared/Pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { api, apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { messageForError } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { RESPONSE_TAB_LABELS } from '@/features/player/types';
import type { EventResponseRow, MatrixMaterialData } from './types';

/**
 * EventResponsesTable — TDD §6.9: agregasi seluruh Jawaban/Komentar/Issue pada
 * satu event, dapat difilter per tipe & per materi, dengan aksi menandai issue
 * sebagai `resolved`.
 *
 * Warna badge mengikuti semantik §6.1: Jawaban `primary`, Komentar neutral,
 * Issue `error` (blocker) / `tertiary` (pending/open).
 */
const TYPE_OPTIONS = [
  { value: 'all', label: 'Semua tipe' },
  { value: 'answer', label: RESPONSE_TAB_LABELS.answer },
  { value: 'comment', label: RESPONSE_TAB_LABELS.comment },
  { value: 'issue', label: RESPONSE_TAB_LABELS.issue },
];

const ISSUE_STATUS_OPTIONS = [
  { value: 'all', label: 'Semua issue' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

export function EventResponsesTable({
  eventId,
  materials,
  type,
  materialId,
  issueStatus,
}: {
  eventId: number;
  materials: MatrixMaterialData[];
  type: string;
  materialId: number | null;
  issueStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const pagination = useCursorPagination();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === 'all' || value === '') params.delete(key);
    else params.set(key, value);
    pagination.reset();
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const queryKey = [
    ...qk.admin.events.responses(eventId, {
      type,
      materialId: materialId ?? undefined,
      issueStatus,
    }),
    pagination.cursor,
  ];

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiFetchWithMeta<{ items: EventResponseRow[] }>(
        `/admin/events/${eventId}/responses`,
        {
          query: {
            type: type === 'all' ? undefined : type,
            materialId: materialId ?? undefined,
            issueStatus: issueStatus === 'all' ? undefined : issueStatus,
            cursor: pagination.cursor ?? undefined,
            limit: PAGE_SIZE.eventResponses,
          },
        },
      );
      const nextCursor = response.meta?.nextCursor;
      return {
        items: response.data.items,
        nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
      };
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (input: { responseId: number; next: 'open' | 'resolved' }) =>
      api.patch<{ response: EventResponseRow }>(
        `/admin/responses/${input.responseId}/issue-status`,
        { issueStatus: input.next },
      ),
    onSuccess: () => {
      toast.success('Status issue diperbarui');
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: qk.admin.dashboard.activity(eventId) });
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  // Admin all-access (moderasi): boleh menghapus respons APA PUN — termasuk
  // yang dibuat peserta lain — lewat `DELETE /admin/responses/:id`.
  const deleteMutation = useMutation({
    mutationFn: (responseId: number) => api.delete(`/admin/responses/${responseId}`),
    onSuccess: () => {
      toast.success('Respons dihapus');
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: qk.admin.dashboard.activity(eventId) });
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant p-4">
        <Select value={type} onValueChange={(value) => setParam('type', value)}>
          <SelectTrigger className="w-44" aria-label="Filter tipe respons">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={materialId === null ? 'all' : String(materialId)}
          onValueChange={(value) => setParam('materialId', value)}
        >
          <SelectTrigger className="w-56" aria-label="Filter materi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua materi</SelectItem>
            {materials.map((material) => (
              <SelectItem key={material.id} value={String(material.id)}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(type === 'issue' || type === 'all') && (
          <Select value={issueStatus} onValueChange={(value) => setParam('issueStatus', value)}>
            <SelectTrigger className="w-40" aria-label="Filter status issue">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isPending ? (
        <TableSkeleton rows={5} columns={4} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon="forum"
          title="Tidak ada respons"
          description="Belum ada respons yang cocok dengan filter ini."
          className="m-4"
        />
      ) : (
        <ul className="flex flex-col">
          {data.items.map((row) => (
            <li
              key={row.id}
              className="flex gap-4 border-b border-outline-variant p-4 last:border-0"
            >
              <Avatar className="mt-1 h-10 w-10 shrink-0">
                <AvatarFallback>{row.user.initials}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-title-md text-on-surface">{row.user.name}</span>
                  <Badge
                    variant={
                      row.type === 'answer' ? 'answer' : row.type === 'issue' ? 'issue' : 'comment'
                    }
                  >
                    {RESPONSE_TAB_LABELS[row.type]}
                  </Badge>
                  {row.type === 'issue' && row.issueStatus && (
                    <Badge variant={row.issueStatus === 'open' ? 'pending' : 'completed'}>
                      {row.issueStatus === 'open' ? 'Open' : 'Resolved'}
                    </Badge>
                  )}
                  <span className="text-label-sm text-on-surface-variant">
                    {row.material.title} · {formatDateTime(row.createdAt)}
                  </span>
                </div>

                {row.contentHtml ? (
                  <div
                    className="prose-material text-body-sm text-on-surface-variant"
                    // HTML sudah tersanitasi DI SERVER (`renderResponseContent`, §8.4).
                    dangerouslySetInnerHTML={{ __html: row.contentHtml }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-body-sm text-on-surface-variant">
                    {row.content}
                  </p>
                )}
              </div>

              <span className="flex shrink-0 flex-col items-end gap-2 self-start">
                {row.type === 'issue' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({
                        responseId: row.id,
                        next: row.issueStatus === 'resolved' ? 'open' : 'resolved',
                      })
                    }
                  >
                    <MaterialIcon name={row.issueStatus === 'resolved' ? 'undo' : 'task_alt'} />
                    {row.issueStatus === 'resolved' ? 'Buka lagi' : 'Tandai resolved'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-error"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Hapus respons dari ${row.user.name}? Tindakan tidak bisa dibatalkan.`,
                      )
                    ) {
                      deleteMutation.mutate(row.id);
                    }
                  }}
                >
                  <MaterialIcon name="delete" />
                  Hapus
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        rowsPerPage={PAGE_SIZE.eventResponses}
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
