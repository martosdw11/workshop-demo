'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { StatusPill } from '@/components/shared/StatusPill';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { api } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { cn } from '@/lib/utils';
import type { AdminEvent } from './types';

/**
 * PublishBar — TDD §6.7: Save Draft / Preview / Publish.
 *
 * Penanganan error yang wajib terlihat jelas (§9.4):
 *   `422 EVENT_HAS_NO_MATERIAL` → tambahkan materi dulu
 *
 * Kembali ke Draft diperbolehkan walau event sudah berpeserta: enrollment yang
 * ada tidak dihapus — peserta lama tetap bisa melanjutkan, event hanya berhenti
 * menerima peserta baru.
 *
 * Peringatan §4.6 ditampilkan permanen, bukan hanya saat error: mengubah
 * `points` setelah ada peserta yang menyelesaikan materi HANYA berlaku untuk
 * peserta berikutnya — perilaku itu harus eksplisit di UI, bukan kejutan.
 */
export function PublishBar({ event }: { event: AdminEvent }) {
  const router = useRouter();
  const [confirmUnpublish, setConfirmUnpublish] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const publishMutation = useMutation({
    mutationFn: (status: 'published' | 'draft') =>
      api.post<{ event: AdminEvent }>(`/admin/events/${event.id}/publish`, { status }),
    onSuccess: (data) => {
      setErrorMessage(null);
      setConfirmUnpublish(false);
      toast.success(
        data.event.status === 'published'
          ? 'Event dipublikasikan dan muncul di katalog peserta.'
          : 'Event dikembalikan ke Draft.',
      );
      router.refresh();
    },
    onError: (error) => {
      setErrorMessage(messageForError(error));
      toast.error(messageForError(error));
    },
  });

  const isPublished = event.status === 'published';

  return (
    <div className="sticky bottom-0 z-30 border-t border-outline-variant bg-surface px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill variant={event.status} />
          <span className="text-label-sm text-on-surface-variant">
            {event.materialCount} materi · {event.totalPoints} poin · {event.enrolledCount} peserta
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/events/${event.id}/preview`}
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            <MaterialIcon name="visibility" />
            Preview
          </Link>

          {isPublished ? (
            <Button variant="secondary" onClick={() => setConfirmUnpublish(true)}>
              <MaterialIcon name="unpublished" />
              Kembalikan ke Draft
            </Button>
          ) : (
            <Button
              onClick={() => publishMutation.mutate('published')}
              disabled={publishMutation.isPending}
            >
              <MaterialIcon name="publish" />
              {publishMutation.isPending ? 'Memproses…' : 'Publish'}
            </Button>
          )}
        </div>
      </div>

      {event.enrolledCount > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed/50 px-3 py-2 text-body-sm text-on-tertiary-fixed">
          <MaterialIcon name="info" className="text-[18px]" />
          Event ini sudah diikuti peserta. Perubahan bobot <strong>points</strong> hanya berlaku
          untuk peserta berikutnya — poin yang sudah diraih tidak dihitung ulang (TDD §4.6).
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-error-container bg-error-container/40 px-3 py-2 text-body-sm text-on-error-container"
        >
          <MaterialIcon name="error" className="text-[18px]" />
          {errorMessage}
        </p>
      )}

      <Dialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kembalikan event ke Draft?</DialogTitle>
            <DialogDescription>
              Event Draft tidak lagi menerima peserta baru dan hilang dari katalog umum. Peserta yang
              sudah bergabung ({event.enrolledCount} orang) tetap dipertahankan dan masih bisa
              melanjutkan event ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmUnpublish(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => publishMutation.mutate('draft')}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Memproses…' : 'Kembalikan ke Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
