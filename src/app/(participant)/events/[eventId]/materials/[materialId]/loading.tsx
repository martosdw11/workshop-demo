import { ListSkeleton, PlayerSkeleton } from '@/components/shared/LoadingSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading state Learning Player: sidebar kurikulum + area konten. */
export default function MaterialLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Memuat materi"
      className="flex flex-col lg:flex-row"
    >
      <div className="w-full shrink-0 border-b border-outline-variant bg-surface-container-low p-6 lg:w-80 lg:border-b-0 lg:border-r">
        <Skeleton className="mb-4 h-6 w-40" />
        <Skeleton className="mb-6 h-progress w-full" />
        <ListSkeleton count={4} />
      </div>

      <div className="mx-auto w-full max-w-5xl px-container-mobile py-8 md:px-container-desktop">
        <PlayerSkeleton />
      </div>
    </div>
  );
}
