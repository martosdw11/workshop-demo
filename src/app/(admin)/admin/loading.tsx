import { KpiGridSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading state area admin.
 *
 * Berbeda dari area peserta, boundary di level segmen `admin/` aman di sini:
 * tidak ada halaman admin yang tugasnya murni `redirect()`, sehingga streaming
 * tidak mengubah status respons mana pun.
 */
export default function AdminLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Memuat halaman admin"
      className="px-container-mobile py-6 md:px-container-desktop"
    >
      <Skeleton className="mb-3 h-8 w-56" />
      <Skeleton className="mb-8 h-5 w-72" />
      <div className="mb-8">
        <KpiGridSkeleton />
      </div>
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <TableSkeleton />
      </div>
    </div>
  );
}
