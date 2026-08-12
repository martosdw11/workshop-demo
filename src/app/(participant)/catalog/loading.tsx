import { CardGridSkeleton } from '@/components/shared/LoadingSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading state Event Catalog (lihat catatan penempatan di dashboard/loading.tsx). */
export default function CatalogLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Memuat katalog event"
      className="mx-auto max-w-7xl px-container-mobile py-8 md:px-container-desktop"
    >
      <Skeleton className="mb-3 h-8 w-56" />
      <Skeleton className="mb-8 h-5 w-96" />
      <CardGridSkeleton />
    </div>
  );
}
