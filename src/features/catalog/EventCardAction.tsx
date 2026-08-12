'use client';

import Link from 'next/link';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventCardData } from './types';

/**
 * EventCardAction — TDD §6.5: aksi kontekstual `Join Event` → `Resume`
 * (+ progress bar) → `View Results`, mengikuti tiga varian kartu pada mockup.
 */
export type EventCardActionProps = {
  event: EventCardData;
  onJoin: () => void;
};

export function EventCardAction({ event, onJoin }: EventCardActionProps) {
  if (event.myStatus === 'in_progress') {
    return (
      <div className="mt-auto flex flex-col gap-3">
        <ProgressBar
          value={event.progressPercent ?? 0}
          label={`Progres ${event.title}`}
        />
        <Link
          href={event.resumeUrl ?? `/events/${event.id}`}
          className={cn(buttonVariants({ variant: 'secondary' }), 'w-full text-primary')}
        >
          <MaterialIcon name="play_arrow" filled />
          Resume
        </Link>
      </div>
    );
  }

  if (event.myStatus === 'completed') {
    return (
      <Link
        href={event.resultUrl ?? `/events/${event.id}/result`}
        className={cn(buttonVariants({ variant: 'secondary' }), 'mt-auto w-full')}
      >
        <MaterialIcon name="visibility" />
        View Results
      </Link>
    );
  }

  return (
    <Button className="mt-auto w-full" onClick={onJoin}>
      <MaterialIcon name="add_circle" />
      Join Event
    </Button>
  );
}
