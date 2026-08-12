'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { api, isApiError } from '@/lib/api-client';
import { messageForError, rateLimitMessage } from '@/lib/error-messages';
import { formatDateRange } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { EventCardData } from './types';

/**
 * JoinConfirmDialog — TDD §6.5, PRD §3.A.3 & §4.1 langkah 5.
 *
 * Isi WAJIB: pertanyaan "Apakah Anda yakin akan mengikuti event ini?",
 * ringkasan event, peringatan event **tidak dapat diikuti ulang**, tombol Cancel
 * & Join Event. Tombol confirm disabled selama `pending` — peredam double-click
 * yang melengkapi idempotensi struktural di database (§4.4).
 *
 * Penanganan `409` (§9.4): `ALREADY_ENROLLED` BUKAN error merah. Ia berarti
 * peserta memang sudah terdaftar, jadi dialog berubah menjadi informatif dengan
 * tombol **Resume** ke `details.resumeUrl`. `QUOTA_FULL` ditampilkan sebagai
 * pesan kuota penuh di dalam dialog yang sama.
 */
type EnrollResponse = {
  enrollment: { id: number };
  firstMaterialId: number | null;
  redirectTo: string;
};

export type JoinConfirmDialogProps = {
  event: EventCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function JoinConfirmDialog({ event, open, onOpenChange }: JoinConfirmDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [alreadyEnrolledUrl, setAlreadyEnrolledUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Bersihkan state informatif setiap dialog dibuka untuk event lain.
  React.useEffect(() => {
    if (open) {
      setAlreadyEnrolledUrl(null);
      setErrorMessage(null);
    }
  }, [open, event?.id]);

  const mutation = useMutation({
    mutationFn: (eventId: number) => api.post<EnrollResponse>(`/events/${eventId}/enroll`),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: qk.events.all });
      void queryClient.invalidateQueries({ queryKey: qk.me.dashboard });
      onOpenChange(false);
      router.push(data.redirectTo);
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'ALREADY_ENROLLED') {
        const resumeUrl = error.details?.resumeUrl;
        setAlreadyEnrolledUrl(typeof resumeUrl === 'string' ? resumeUrl : null);
        return;
      }
      if (isApiError(error) && error.status === 429) {
        toast.error(rateLimitMessage(error.retryAfterSeconds));
        return;
      }
      if (isApiError(error) && error.status >= 500) {
        toast.error(messageForError(error));
        return;
      }
      setErrorMessage(messageForError(error));
    },
  });

  if (!event) return null;

  const isAlreadyEnrolled = alreadyEnrolledUrl !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAlreadyEnrolled ? 'Anda sudah terdaftar' : 'Confirm Joining'}</DialogTitle>
          <DialogDescription>
            {isAlreadyEnrolled
              ? 'Anda sudah mengikuti event ini. Lanjutkan dari materi terakhir Anda.'
              : 'Apakah Anda yakin akan mengikuti event ini?'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h4 className="text-label-md text-on-surface">{event.title}</h4>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            Jadwal: {formatDateRange(event.startAt, event.endAt)}
          </p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {event.materialCount} materi · {event.totalPoints} poin tersedia
          </p>
        </div>

        {!isAlreadyEnrolled && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed/50 px-4 py-3 text-body-sm text-on-tertiary-fixed">
            <MaterialIcon name="warning" className="text-[18px]" />
            Event ini <strong className="font-semibold">tidak dapat diikuti ulang</strong>. Setelah
            bergabung, keikutsertaan Anda tercatat permanen.
          </p>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-body-sm text-on-error-container"
          >
            <MaterialIcon name="error" className="text-[18px]" />
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {isAlreadyEnrolled ? 'Tutup' : 'Cancel'}
          </Button>

          {isAlreadyEnrolled ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push(alreadyEnrolledUrl ?? `/events/${event.id}`);
              }}
            >
              <MaterialIcon name="play_arrow" filled />
              Resume
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate(event.id)} disabled={mutation.isPending}>
              {mutation.isPending ? 'Memproses…' : 'Join Event'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
