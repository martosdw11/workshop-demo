'use client';

import { Input } from '@/components/ui/input';
import { LIMITS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * PointsInput — TDD §6.7: numerik, `min=0`, perubahan nilainya memicu
 * rekalkulasi `CurriculumSummaryPanel` (derived di client, tanpa panggilan API).
 *
 * Nilai kosong dipetakan ke 0, bukan `NaN`: bobot poin yang tidak diisi berarti
 * materi tanpa poin, dan `NaN` akan lolos ke ringkasan sebagai total rusak.
 */
export function PointsInput({
  value,
  onChange,
  disabled,
  id,
  className,
}: {
  value: number;
  onChange: (points: number) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-label-sm uppercase text-on-surface-variant">
        Pts
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={LIMITS.pointsMin}
        max={LIMITS.pointsMax}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          const next = Number.isNaN(parsed) ? 0 : parsed;
          onChange(Math.min(LIMITS.pointsMax, Math.max(LIMITS.pointsMin, next)));
        }}
        className="w-24"
      />
    </div>
  );
}
