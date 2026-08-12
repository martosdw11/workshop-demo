'use client';

import { Button } from '@/components/ui/button';
import { messageForError } from '@/lib/error-messages';
import { cn } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';

/**
 * State error + retry.
 *
 * Teksnya SELALU berasal dari `lib/error-messages.ts` (peta `code` → pesan §9.4),
 * bukan dari `error.message` mentah — supaya satu kode menghasilkan satu kalimat
 * yang sama di seluruh aplikasi dan detail internal tidak pernah bocor ke layar.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Gagal memuat data',
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-error-container',
        'bg-error-container/40 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <MaterialIcon name="error" className="text-[24px]" />
      </span>
      <p className="text-title-md text-on-surface">{title}</p>
      <p className="max-w-md text-body-sm text-on-surface-variant">{messageForError(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          <MaterialIcon name="refresh" />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
