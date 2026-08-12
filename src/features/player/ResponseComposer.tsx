'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { api, isApiError } from '@/lib/api-client';
import { messageForError, rateLimitMessage } from '@/lib/error-messages';
import { qk } from '@/lib/query-keys';
import { LIMITS } from '@/lib/constants';
import { responseContentSchema } from '@/lib/validation/response';
import { RESPONSE_TAB_LABELS, type ResponseItemData, type ResponseType } from './types';

/**
 * ResponseComposer — TDD §6.6.
 *
 * **Optimistic update**: respons langsung muncul di timeline sebelum server
 * menjawab, lalu diganti data asli saat `201` datang. Bila gagal, cache
 * dikembalikan ke snapshot sebelumnya (`onError`) — tidak ada respons "hantu"
 * yang tertinggal di layar.
 *
 * Tombol disabled selama `pending` — peredam double-submit yang disebut §4.4;
 * `POST /responses` memang SENGAJA tidak idempoten (peserta boleh mengirim
 * berulang tanpa batas, PRD §3.A.4), jadi peredamnya ada di UI + rate limit.
 *
 * Komponen ini TIDAK DIRENDER SAMA SEKALI saat enrollment `completed` —
 * pemanggil (`ResponsePanel`) yang memutuskan (§6.6 "Aturan read-only").
 */
type ResponsePage = { items: ResponseItemData[]; nextCursor: string | null };

export function ResponseComposer({
  materialId,
  enrollmentId,
  type,
  author,
}: {
  materialId: number;
  enrollmentId: number;
  type: ResponseType;
  author: { id: number; name: string; initials: string };
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');

  const queryKey = qk.player.responses(materialId, type);

  const mutation = useMutation({
    mutationFn: (value: string) =>
      api.post<{ response: ResponseItemData; materialWillEarnPoints: boolean }>(
        `/materials/${materialId}/responses`,
        { type, content: value },
      ),

    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<ResponsePage>>(queryKey);

      // ID sementara negatif: tidak mungkin bertabrakan dengan id dari database.
      const optimistic: ResponseItemData = {
        id: -Date.now(),
        materialId,
        enrollmentId,
        type,
        content: value,
        issueStatus: type === 'issue' ? 'open' : null,
        createdAt: new Date().toISOString(),
        author,
      };

      queryClient.setQueryData<InfiniteData<ResponsePage>>(queryKey, (old) => {
        if (!old) return { pages: [{ items: [optimistic], nextCursor: null }], pageParams: [null] };
        const [first, ...rest] = old.pages;
        return {
          ...old,
          pages: [{ ...first, items: [optimistic, ...first.items] }, ...rest],
        };
      });

      return { previous, optimisticId: optimistic.id };
    },

    onError: (mutationError, _value, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);

      if (isApiError(mutationError) && mutationError.status === 429) {
        toast.error(rateLimitMessage(mutationError.retryAfterSeconds));
        return;
      }
      if (
        isApiError(mutationError) &&
        (mutationError.code === 'ENROLLMENT_COMPLETED' || mutationError.code === 'MATERIAL_LOCKED')
      ) {
        // Status enrollment/materi berubah di sesi lain: halaman harus dimuat
        // ulang agar composer hilang sesuai aturan penguncian, bukan sekadar
        // menampilkan pesan sambil membiarkan form tetap terbuka.
        toast.error(messageForError(mutationError));
        router.refresh();
        return;
      }
      setError(messageForError(mutationError));
    },

    onSuccess: (data, _value, context) => {
      // Ganti item optimistic dengan data asli (id & createdAt dari server).
      queryClient.setQueryData<InfiniteData<ResponsePage>>(queryKey, (old) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        return {
          ...old,
          pages: [
            {
              ...first,
              items: first.items.map((item) =>
                item.id === context?.optimisticId ? data.response : item,
              ),
            },
            ...rest,
          ],
        };
      });

      setContent('');
      setError(null);
      setAnnouncement(
        data.materialWillEarnPoints
          ? 'Respons terkirim. Materi ini sudah memenuhi syarat poin.'
          : 'Respons terkirim.',
      );

      // Badge poin di header materi bergantung pada keberadaan jawaban.
      if (type === 'answer') router.refresh();
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = responseContentSchema.safeParse(content);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Respons tidak valid.');
      return;
    }
    mutation.mutate(parsed.data);
  };

  const remaining = LIMITS.responseContentMax - content.length;

  return (
    <form onSubmit={submit} className="mb-8">
      <label htmlFor={`composer-${type}`} className="sr-only">
        Tulis {RESPONSE_TAB_LABELS[type]}
      </label>
      <Textarea
        id={`composer-${type}`}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={`Tulis ${RESPONSE_TAB_LABELS[type].toLowerCase()} Anda di sini…`}
        maxLength={LIMITS.responseContentMax}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `composer-${type}-error` : undefined}
        className="min-h-32 resize-y"
      />

      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          {error ? (
            <p id={`composer-${type}-error`} role="alert" className="text-body-sm text-error">
              {error}
            </p>
          ) : (
            <p className="text-label-sm text-on-surface-variant">
              {remaining < 500 ? `${remaining} karakter tersisa` : 'Anda dapat mengirim tanpa batas.'}
            </p>
          )}
        </div>

        <Button type="submit" disabled={mutation.isPending || content.trim() === ''}>
          <MaterialIcon name="send" className="text-[18px]" />
          {mutation.isPending ? 'Mengirim…' : 'Submit Response'}
        </Button>
      </div>

      {/* Perubahan async diumumkan lewat aria-live (§6.10). */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </form>
  );
}
