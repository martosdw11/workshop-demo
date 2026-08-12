import Link from 'next/link';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { buttonVariants } from '@/components/ui/button';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * ReadOnlyBanner — TDD §6.6. Muncul **menggantikan** `ResponseComposer` setelah
 * Finish (PRD §3.A.4 "State terkunci"): timeline tetap terbaca, input hilang.
 */
export function ReadOnlyBanner({
  completedAt,
  totalPoints,
  resultHref,
}: {
  completedAt: string | null;
  totalPoints: number;
  resultHref?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-lg border border-secondary-fixed-dim bg-secondary-fixed/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MaterialIcon name="lock" className="mt-0.5 text-[20px] text-on-secondary-fixed" />
        <div>
          <p className="text-label-md text-on-secondary-fixed">
            Event ini sudah Anda selesaikan — respons dikunci.
          </p>
          <p className="text-body-sm text-on-secondary-fixed-variant">
            {completedAt ? `Diselesaikan ${formatDateTime(completedAt)} · ` : ''}
            Total {formatNumber(totalPoints)} poin. Diskusi tetap dapat dibaca.
          </p>
        </div>
      </div>

      {resultHref && (
        <Link href={resultHref} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
          <MaterialIcon name="visibility" />
          View Results
        </Link>
      )}
    </div>
  );
}
