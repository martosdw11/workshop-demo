'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { api } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { ResponseRichEditor } from './ResponseRichEditor';
import type { IssueCommentData, ResponseDoc } from './types';

/**
 * IssueThread — thread komentar pada SATU kartu issue.
 *
 * Karena issue terlihat lintas peserta, thread membuat diskusi fokus pada satu
 * postingan: seluruh peserta event + admin bisa membantu di dalamnya. Komponen
 * ini dipakai DUA sisi — Learning Player (peserta) dan layar admin Responses —
 * perbedaannya hanya pada props (`isAdmin`, `canComment`).
 *
 * Aturan aksi mengikuti pola respons: edit hanya milik sendiri; hapus milik
 * sendiri atau admin (all-access). Komentar admin diberi badge "Admin".
 *
 * Thread dimuat LAZY: query baru berjalan setelah kartu di-expand — kartu yang
 * tidak dibuka tidak menambah request.
 */
function CommentBubble({
  comment,
  actions,
}: {
  comment: IssueCommentData;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Avatar className="mt-1 h-8 w-8 shrink-0 text-label-sm">
        <AvatarFallback>{comment.author.initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 rounded-lg bg-surface-container-low p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="text-title-sm text-on-surface">{comment.author.name}</span>
            {comment.author.isAdmin && <Badge variant="answer">Admin</Badge>}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-label-sm text-on-surface-variant">
              {formatRelativeTime(comment.createdAt)}
              {comment.editedAt && ' · (diedit)'}
            </span>
            {actions}
          </span>
        </div>
        {comment.contentHtml ? (
          <div
            className="prose-material text-body-sm text-on-surface-variant"
            // HTML sudah tersanitasi DI SERVER (`deriveContent`, §8.4).
            dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-body-sm text-on-surface-variant">
            {comment.content}
          </p>
        )}
      </div>
    </li>
  );
}

function IconAction({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
        danger ? 'text-error' : 'text-on-surface-variant'
      }`}
    >
      <MaterialIcon name={icon} className="text-[16px]" />
    </button>
  );
}

export function IssueThread({
  responseId,
  currentUserId,
  isAdmin = false,
  canComment,
  initialCount,
}: {
  responseId: number;
  /** id user login — pembanding kepemilikan aksi edit/hapus komentar. */
  currentUserId: number;
  /** Admin: badge + hak hapus komentar siapa pun. */
  isAdmin?: boolean;
  /** `false` saat read-only (peserta yang sudah finish) — composer disembunyikan. */
  canComment: boolean;
  /** Jumlah komentar dari listing induk — label toggle sebelum thread dimuat. */
  initialCount: number;
}) {
  const queryClient = useQueryClient();
  const queryKey = qk.issueComments(responseId);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ doc: ResponseDoc; text: string } | null>(null);
  const [composerKey, setComposerKey] = React.useState(0);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState<{ doc: ResponseDoc; text: string } | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey,
    enabled: open,
    queryFn: () => api.get<{ items: IssueCommentData[] }>(`/responses/${responseId}/comments`),
  });

  const comments = data?.items ?? [];
  const count = data ? comments.length : initialCount;

  const setItems = (updater: (items: IssueCommentData[]) => IssueCommentData[]) =>
    queryClient.setQueryData<{ items: IssueCommentData[] }>(queryKey, (old) =>
      old ? { items: updater(old.items) } : old,
    );

  const createMutation = useMutation({
    mutationFn: (value: { doc: ResponseDoc }) =>
      api.post<{ comment: IssueCommentData }>(`/responses/${responseId}/comments`, {
        contentJson: value.doc,
      }),
    onSuccess: (result) => {
      setItems((items) => [...items, result.comment]);
      setDraft(null);
      setComposerKey((key) => key + 1);
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const updateMutation = useMutation({
    mutationFn: (value: { id: number; doc: ResponseDoc }) =>
      api.patch<{ comment: IssueCommentData }>(`/issue-comments/${value.id}`, {
        contentJson: value.doc,
      }),
    onSuccess: (result) => {
      setItems((items) =>
        items.map((item) => (item.id === result.comment.id ? result.comment : item)),
      );
      setEditingId(null);
      setEditDraft(null);
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/issue-comments/${id}`),
    onSuccess: (_result, id) => {
      setItems((items) => items.filter((item) => item.id !== id));
      toast.success('Komentar dihapus');
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  return (
    <div className="mt-3 border-t border-outline-variant pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-label-md text-primary transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <MaterialIcon name={open ? 'expand_less' : 'forum'} className="text-[18px]" />
        {count === 0 ? 'Bantu / komentari issue ini' : `${count} komentar`}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {isPending ? (
            <p className="text-body-sm text-on-surface-variant">Memuat komentar…</p>
          ) : error ? (
            <p className="text-body-sm text-error">{messageForError(error)}</p>
          ) : comments.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              Belum ada komentar. Jadilah yang pertama membantu.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {comments.map((comment) => {
                const isOwn = comment.author.id === currentUserId;

                if (isOwn && comment.id === editingId) {
                  return (
                    <li key={comment.id} className="flex gap-3">
                      <Avatar className="mt-1 h-8 w-8 shrink-0 text-label-sm">
                        <AvatarFallback>{comment.author.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <ResponseRichEditor
                          id={`edit-comment-${comment.id}`}
                          placeholder="Perbarui komentar Anda…"
                          initialHtml={
                            comment.contentHtml ??
                            `<p>${comment.content.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`
                          }
                          onChange={setEditDraft}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft(null);
                            }}
                          >
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              updateMutation.isPending || (editDraft?.text.trim() ?? '') === ''
                            }
                            onClick={() =>
                              editDraft &&
                              updateMutation.mutate({ id: comment.id, doc: editDraft.doc })
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
                  <CommentBubble
                    key={comment.id}
                    comment={comment}
                    actions={
                      <>
                        {isOwn && canComment && (
                          <IconAction
                            icon="edit"
                            label="Edit komentar"
                            onClick={() => {
                              setEditDraft(null);
                              setEditingId(comment.id);
                            }}
                          />
                        )}
                        {(isOwn || isAdmin) && (
                          <IconAction
                            icon="delete"
                            label="Hapus komentar"
                            danger
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Hapus komentar ini?')) {
                                deleteMutation.mutate(comment.id);
                              }
                            }}
                          />
                        )}
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}

          {canComment && (
            <div>
              <ResponseRichEditor
                key={composerKey}
                id={`thread-composer-${responseId}`}
                placeholder="Tulis komentar untuk membantu…"
                onChange={setDraft}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  disabled={createMutation.isPending || (draft?.text.trim() ?? '') === ''}
                  onClick={() => draft && createMutation.mutate({ doc: draft.doc })}
                >
                  <MaterialIcon name="send" className="text-[16px]" />
                  {createMutation.isPending ? 'Mengirim…' : 'Kirim komentar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
