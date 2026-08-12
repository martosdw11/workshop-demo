'use client';

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
import { formatNumber } from '@/lib/format';

/**
 * FinishConfirmDialog — TDD §6.6, PRD §4.1 langkah 9.
 *
 * Finish adalah aksi TERMINAL: setelah ini seluruh respons pada event menjadi
 * read-only dan poin dikunci. Dialog karena itu menyatakan konsekuensinya secara
 * eksplisit, bukan sekadar "Anda yakin?".
 */
export function FinishConfirmDialog({
  open,
  onOpenChange,
  summary,
  onConfirm,
  isPending,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    eventTitle: string;
    completedMaterialCount: number;
    materialsTotal: number;
    totalPoints: number;
    pointsAvailable: number;
  };
  onConfirm: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selesaikan event ini?</DialogTitle>
          <DialogDescription>
            Setelah Finish, seluruh respons Anda pada event ini menjadi read-only dan poin dikunci.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h4 className="text-label-md text-on-surface">{summary.eventTitle}</h4>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-label-sm text-on-surface-variant">
            <dt>Materi selesai</dt>
            <dd className="text-right text-on-surface">
              {summary.completedMaterialCount} / {summary.materialsTotal}
            </dd>
            <dt>Poin diperoleh</dt>
            <dd className="text-right text-on-surface">
              {formatNumber(summary.totalPoints)} / {formatNumber(summary.pointsAvailable)}
            </dd>
          </dl>
        </div>

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
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Memproses…' : 'Finish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
