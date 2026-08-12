import { clampPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * ProgressBar — TDD §6.2.
 *
 * Dual-tone (track `surface-container-high` + fill `primary`), tinggi 6px
 * (`h-progress`), track membulat (DESIGN.md "Progress Bars"). Mode `segmented`
 * dipakai event multi-tahap: satu ruas per materi, sehingga peserta melihat
 * "3 dari 8 materi" tanpa membaca angka.
 *
 * Aksesibilitas: elemen ini `role="progressbar"` dengan `aria-valuenow`, dan
 * pemanggil WAJIB memberi `label` supaya screen reader tahu progres apa.
 */
export type ProgressBarProps = {
  /** 0–100. Dibulatkan & dijepit di dalam komponen. */
  value: number;
  label: string;
  segmented?: boolean;
  /** Jumlah ruas saat `segmented` — biasanya jumlah materi. */
  segments?: number;
  /** Jumlah ruas terisi saat `segmented` — biasanya materi yang selesai. */
  filledSegments?: number;
  className?: string;
  indicatorClassName?: string;
};

export function ProgressBar({
  value,
  label,
  segmented = false,
  segments = 0,
  filledSegments = 0,
  className,
  indicatorClassName,
}: ProgressBarProps) {
  const percent = clampPercent(value);

  if (segmented && segments > 0) {
    return (
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('flex w-full items-center gap-1', className)}
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-progress flex-1 rounded-full transition-colors',
              index < filledSegments ? 'bg-primary' : 'bg-surface-container-high',
              index < filledSegments && indicatorClassName,
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-progress w-full overflow-hidden rounded-full bg-surface-container-high', className)}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-300', indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
