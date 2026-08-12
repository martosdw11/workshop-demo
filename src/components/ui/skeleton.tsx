import { cn } from '@/lib/utils';

/**
 * Placeholder loading. `aria-hidden` disengaja: pengumuman status pemuatan
 * dilakukan wadahnya lewat `aria-busy`/`aria-live`, bukan oleh puluhan kotak abu.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-lg bg-surface-container-high', className)}
      {...props}
    />
  );
}
