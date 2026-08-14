'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { api, apiFetchWithMeta } from '@/lib/api-client';
import { PAGE_SIZE } from '@/lib/constants';
import { messageForError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { IssueThread } from './IssueThread';
import { ResponseRichEditor } from './ResponseRichEditor';
import {
  RESPONSE_TAB_LABELS,
  type ResponseDoc,
  type ResponseItemData,
  type ResponseType,
} from './types';

/**
 * ResponseItem — TDD §6.6: avatar inisial, nama, waktu relatif.
 *
 * TIDAK ADA tombol like/reply (A-10) — mockup memilikinya, tapi keduanya di luar
 * §3 PRD. Sesuai A-10 tombolnya **dihapus**, bukan di-disable.
 *
 * Konten: `contentHtml` adalah keluaran rich editor yang **sudah tersanitasi
 * DI SERVER** (`renderResponseContent`, §8.4) — hanya itu yang boleh masuk
 * `dangerouslySetInnerHTML`. Respons lama era plain-text (`contentHtml: null`)
 * dan item optimistic jatuh kembali ke `content` sebagai text node biasa
 * dengan `whitespace-pre-wrap`.
 *
 * `actions` (opsional) dirender di pojok kanan header — dipakai timeline untuk
 * tombol Edit/Hapus pada pesan milik user login sendiri (semua tipe).
 * `children` (opsional) dirender DI DALAM kartu setelah konten — dipakai untuk
 * thread komentar issue.
 */
export function ResponseItem({
  item,
  actions,
  children,
}: {
  item: ResponseItemData;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
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
              {item.editedAt && ' · (diedit)'}
            </span>
            {actions}
          </span>
        </div>
        {item.contentHtml ? (
          <div
            className="prose-material text-body-md text-on-surface-variant"
            dangerouslySetInnerHTML={{ __html: item.contentHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-body-md text-on-surface-variant">{item.content}</p>
        )}
        {children}
      </div>
    </li>
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Isi awal editor mode edit: `content_html` tersanitasi dari server, atau —
 * untuk respons lama era plain-text — teksnya di-escape lalu dibungkus
 * paragraf agar baris baru tidak hilang saat TipTap mem-parse.
 */
function htmlForEditor(item: ResponseItemData): string {
  if (item.contentHtml) return item.contentHtml;
  return `<p>${escapeHtml(item.content).replaceAll('\n', '<br>')}</p>`;
}

type ResponsePage = { items: ResponseItemData[]; nextCursor: string | null };

/**
 * ResponseTimeline — TDD §6.6: infinite scroll 20 item per halaman
 * (`PAGE_SIZE.responses`), keyset cursor dari §3.1.
 *
 * Aksi Edit & Hapus tersedia di SEMUA tab (Jawaban, Komentar, Issue) — tetapi
 * hanya pada pesan yang DIBUAT USER LOGIN SENDIRI. Milik peserta lain (issue
 * lintas peserta) hanya bisa dibaca — penghapusan lintas pemilik adalah
 * wewenang admin (layar admin Responses).
 */
export function ResponseTimeline({
  materialId,
  type,
  currentUserId,
  canModify = false,
}: {
  materialId: number;
  type: ResponseType;
  /** id user login — pembanding kepemilikan untuk aksi Edit/Hapus. */
  currentUserId?: number;
  /** `false` saat read-only (§4.5 setelah finish) — aksi disembunyikan. */
  canModify?: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = qk.player.responses(materialId, type);

  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
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

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<{ doc: ResponseDoc; text: string } | null>(null);

  const closeEditor = () => {
    setEditingId(null);
    setDraft(null);
  };

  const replaceInCache = (updated: ResponseItemData) =>
    queryClient.setQueryData<InfiniteData<ResponsePage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === updated.id ? updated : item)),
            })),
          }
        : old,
    );

  const removeFromCache = (id: number) =>
    queryClient.setQueryData<InfiniteData<ResponsePage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== id),
            })),
          }
        : old,
    );

  const updateMutation = useMutation({
    mutationFn: (value: { id: number; doc: ResponseDoc }) =>
      api.patch<{ response: ResponseItemData }>(`/responses/${value.id}`, {
        contentJson: value.doc,
      }),
    onSuccess: (data) => {
      replaceInCache(data.response);
      closeEditor();
      toast.success('Respons diperbarui');
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/responses/${id}`),
    onSuccess: (_data, id) => {
      removeFromCache(id);
      if (id === editingId) closeEditor();
      toast.success('Respons dihapus');
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

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
        {items.map((item) => {
          // Aksi hanya untuk pesan milik user login sendiri (bukan optimistic).
          const editable = canModify && item.author.id === currentUserId && item.id > 0;

          if (editable && item.id === editingId) {
            return (
              <li key={item.id} className="flex gap-4">
                <Avatar className="mt-1 shrink-0">
                  <AvatarFallback>{item.author.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <ResponseRichEditor
                    id={`edit-response-${item.id}`}
                    placeholder="Perbarui respons Anda…"
                    initialHtml={htmlForEditor(item)}
                    onChange={setDraft}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={closeEditor}>
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateMutation.isPending || (draft?.text.trim() ?? '') === ''}
                      onClick={() =>
                        draft && updateMutation.mutate({ id: item.id, doc: draft.doc })
                      }
                    >
                      {updateMutation.isPending ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <ResponseItem
              key={item.id}
              item={item}
              actions={
                editable ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit respons"
                      title="Edit respons"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      onClick={() => {
                        setDraft(null);
                        setEditingId(item.id);
                      }}
                    >
                      <MaterialIcon name="edit" className="text-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Hapus respons"
                      title="Hapus respons"
                      disabled={deleteMutation.isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                      onClick={() => {
                        if (window.confirm('Hapus respons ini? Tindakan tidak bisa dibatalkan.')) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                    >
                      <MaterialIcon name="delete" className="text-[18px]" />
                    </button>
                  </span>
                ) : undefined
              }
            >
              {/* Thread komentar hanya pada issue nyata (bukan optimistic):
                  seluruh peserta + admin bisa membantu di dalam kartunya. */}
              {item.type === 'issue' && item.id > 0 && currentUserId !== undefined && (
                <IssueThread
                  responseId={item.id}
                  currentUserId={currentUserId}
                  canComment={canModify}
                  initialCount={item.commentCount}
                />
              )}
            </ResponseItem>
          );
        })}
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
