'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { api, isApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { FinishConfirmDialog } from './FinishConfirmDialog';
import type { CompleteResultData, FinishResultData } from './types';

/**
 * PlayerFooterNav — TDD §6.6, PRD §4.1 langkah 8–9.
 *
 * **Next** memanggil `POST /materials/:id/complete`, lalu:
 *   1. mengumumkan poin yang diperoleh (`awarded` / `reason`) lewat `aria-live`,
 *   2. menyegarkan halaman server (progress bar + sidebar ikut berubah),
 *   3. membuka materi berikutnya.
 *
 * Di materi terakhir tombol berubah menjadi **Finish** + dialog konfirmasi →
 * `POST /enrollments/:id/finish` → halaman View Results.
 *
 * Saat `readOnly` (enrollment sudah `completed`), footer hanya menyisakan
 * navigasi Previous/Next TANPA mutasi (§6.6) — materi ditelusuri, bukan
 * diselesaikan ulang.
 */
export type PlayerFooterNavProps = {
  eventId: number;
  enrollmentId: number;
  materialId: number;
  prevId: number | null;
  nextId: number | null;
  isLast: boolean;
  readOnly: boolean;
  summary: {
    eventTitle: string;
    completedMaterialCount: number;
    materialsTotal: number;
    totalPoints: number;
    pointsAvailable: number;
  };
};

export function PlayerFooterNav({
  eventId,
  enrollmentId,
  materialId,
  prevId,
  nextId,
  isLast,
  readOnly,
  summary,
}: PlayerFooterNavProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = React.useState('');
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [finishError, setFinishError] = React.useState<string | null>(null);

  const invalidatePlayer = () => {
    void queryClient.invalidateQueries({ queryKey: qk.player.all });
    void queryClient.invalidateQueries({ queryKey: qk.me.dashboard });
    void queryClient.invalidateQueries({ queryKey: qk.events.all });
  };

  const completeMutation = useMutation({
    mutationFn: () => api.post<CompleteResultData>(`/materials/${materialId}/complete`),
    onSuccess: (data) => {
      setAnnouncement(
        data.awarded
          ? `Materi selesai. Anda memperoleh ${formatNumber(data.pointsEarned)} poin. Progres ${data.enrollment.progressPercent} persen.`
          : data.reason === 'NO_ANSWER_RESPONSE'
            ? `Materi selesai tanpa poin karena belum ada respons bertipe Jawaban. Progres ${data.enrollment.progressPercent} persen.`
            : `Materi ini sudah pernah diselesaikan. Progres ${data.enrollment.progressPercent} persen.`,
      );

      // if (data.awarded) {
      //   toast.success(`+${formatNumber(data.pointsEarned)} poin diperoleh`);
      // } else if (data.reason === 'NO_ANSWER_RESPONSE') {
      //   toast.message('Materi ditandai selesai tanpa poin', {
      //     description: 'Poin materi hanya diberikan bila ada minimal satu respons bertipe Jawaban.',
      //   });
      // }

      invalidatePlayer();

      if (data.nextMaterialId) {
        router.push(`/events/${eventId}/materials/${data.nextMaterialId}`);
      }
      // `refresh()` menyegarkan sidebar & progress yang dirender server.
      router.refresh();
    },
    onError: (error) => {
      toast.error(messageForError(error));
      if (isApiError(error) && (error.status === 403 || error.status === 404)) router.refresh();
    },
  });

  const finishMutation = useMutation({
    /**
     * Finish adalah DUA panggilan, bukan satu. Guard §4.5 mensyaratkan
     * `completed_material_count = material_count` DAN posisi peserta ada di
     * materi terakhir — keduanya baru terpenuhi setelah materi terakhir
     * di-`complete`. `complete` idempoten (§4.4), jadi memanggilnya di sini aman
     * walau peserta sudah pernah menyelesaikan materi ini lewat Previous/Next.
     */
    mutationFn: async () => {
      await api.post<CompleteResultData>(`/materials/${materialId}/complete`);
      return api.post<FinishResultData>(`/enrollments/${enrollmentId}/finish`);
    },
    onSuccess: (data) => {
      invalidatePlayer();
      setFinishOpen(false);
      router.push(data.redirectTo);
      router.refresh();
    },
    onError: (error) => setFinishError(messageForError(error)),
  });

  const handleNext = () => {
    if (readOnly) {
      if (nextId) router.push(`/events/${eventId}/materials/${nextId}`);
      return;
    }
    if (isLast) {
      setFinishError(null);
      setFinishOpen(true);
      return;
    }
    completeMutation.mutate();
  };

  const pending = completeMutation.isPending;

  return (
    <footer className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t border-outline-variant bg-surface px-4 py-4 md:px-6">
      {prevId ? (
        <Link
          href={`/events/${eventId}/materials/${prevId}`}
          className={cn(buttonVariants({ variant: 'secondary' }))}
        >
          <MaterialIcon name="arrow_back" />
          Previous
        </Link>
      ) : (
        <span />
      )}

      {readOnly && !nextId ? (
        <Link
          href={`/events/${eventId}/result`}
          className={cn(buttonVariants({ variant: 'primary' }))}
        >
          <MaterialIcon name="visibility" />
          View Results
        </Link>
      ) : (
        <Button onClick={handleNext} disabled={pending || (readOnly && !nextId)}>
          {pending ? 'Menyimpan…' : isLast && !readOnly ? 'Finish' : 'Next'}
          <MaterialIcon name={isLast && !readOnly ? 'flag' : 'arrow_forward'} />
        </Button>
      )}

      {/* Poin & materi berikutnya diumumkan ke pembaca layar (§6.10). */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <FinishConfirmDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        summary={summary}
        onConfirm={() => finishMutation.mutate()}
        isPending={finishMutation.isPending}
        errorMessage={finishError}
      />
    </footer>
  );
}
