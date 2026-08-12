import Link from 'next/link';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * ContinueLearningCard — TDD §6.4.
 *
 * Datanya berasal dari `continueLearning` pada `GET /me/dashboard`, yang memilih
 * enrollment `in_progress` dengan `last_activity_at` terbaru. Tombolnya menuju
 * `resumeHref` (materi terakhir peserta) — bukan ke halaman event, supaya
 * "lanjutkan" benar-benar melanjutkan.
 */
export type ContinueLearningCardProps = {
  event: {
    eventId: number;
    eventTitle: string;
    coverUrl: string | null;
    resumeHref: string;
  };
  progressPercent: number;
};

export function ContinueLearningCard({ event, progressPercent }: ContinueLearningCardProps) {
  return (
    <section
      aria-labelledby="continue-learning-title"
      className="flex flex-col items-stretch gap-6 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-6 md:flex-row"
    >
      <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:aspect-square md:w-1/3">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- cover berasal dari adapter storage (§8.1) dengan host yang bisa berubah lewat env; `next/image` akan menuntut daftar `remotePatterns` statis.
          <img src={event.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
            <MaterialIcon name="school" className="text-[40px]" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="completed">In Progress</Badge>
        </div>

        <h2 id="continue-learning-title" className="mb-1 text-title-lg text-on-surface">
          {event.eventTitle}
        </h2>

        <div className="mt-auto pt-4">
          <div className="mb-1 flex justify-between text-label-sm text-on-surface-variant">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <ProgressBar
            value={progressPercent}
            label={`Progres ${event.eventTitle}`}
            className="mb-4"
          />
          <Link
            href={event.resumeHref}
            className={cn(buttonVariants({ variant: 'primary' }), 'w-full sm:w-auto')}
          >
            <MaterialIcon name="play_arrow" filled />
            Continue Learning
          </Link>
        </div>
      </div>
    </section>
  );
}
