import { KpiGridSkeleton, ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading state Dashboard Peserta.
 *
 * CATATAN PENEMPATAN: `loading.tsx` sengaja diletakkan PER HALAMAN, bukan di
 * level route group. Sebuah boundary di level group membuat SELURUH halaman di
 * bawahnya menjadi streamed — dan pada halaman yang tugasnya murni `redirect()`
 * (`/events/[eventId]`), respons streamed memaksa Next mengganti `307` dengan
 * `<meta refresh>` berjeda satu detik. Menempatkannya per halaman menjaga
 * redirect tetap instan.
 */
export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Memuat dashboard"
      className="mx-auto max-w-7xl px-container-mobile py-8 md:px-container-desktop"
    >
      <Skeleton className="mb-3 h-8 w-64" />
      <Skeleton className="mb-8 h-5 w-80" />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="flex flex-col gap-gutter lg:col-span-2">
          <Skeleton className="h-48 w-full" />
          <KpiGridSkeleton />
        </div>
        <div className="rounded-lg border border-outline-variant p-4">
          <ListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
