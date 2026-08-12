import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Kumpulan skeleton per bentuk halaman. Dipisahkan dari primitif `Skeleton`
 * supaya bentuk placeholder mengikuti bentuk konten aslinya — placeholder generik
 * satu ukuran justru membuat layout melompat saat data datang.
 *
 * Setiap wadah memakai `aria-busy` + `aria-live="polite"` sehingga status memuat
 * diumumkan sekali, bukan sekali per kotak.
 */

function Busy({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Busy label="Memuat daftar event" className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Busy label="Memuat ringkasan" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
        >
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </Busy>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Busy label="Memuat tabel" className="flex flex-col gap-3 p-4">
      <div className="flex gap-4">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b border-outline-variant pb-3">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={colIndex} className={cn('h-5 flex-1', colIndex === 0 && 'h-10')} />
          ))}
        </div>
      ))}
    </Busy>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Busy label="Memuat daftar" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg border border-outline-variant p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

export function PlayerSkeleton() {
  return (
    <Busy label="Memuat materi" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-2/3" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </Busy>
  );
}
