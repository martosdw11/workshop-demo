import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { formatNumber } from '@/lib/format';

/**
 * CurriculumSummaryPanel — TDD §6.7.
 *
 * **Derived state, dihitung di client.** Ringkasan ini TIDAK memanggil API tiap
 * ketikan: nilainya diturunkan dari draft tree yang sudah ada di memori. Server
 * tetap menghitung `material_count` / `total_points`-nya sendiri saat menyimpan,
 * dan angka itulah yang otoritatif — panel ini hanya umpan balik seketika.
 */
export function CurriculumSummaryPanel({
  moduleCount,
  materialCount,
  totalPoints,
  savingState,
}: {
  moduleCount: number;
  materialCount: number;
  totalPoints: number;
  savingState: 'idle' | 'saving' | 'saved' | 'error';
}) {
  const savingLabel = {
    idle: 'Perubahan tersimpan otomatis',
    saving: 'Menyimpan…',
    saved: 'Tersimpan',
    error: 'Gagal menyimpan',
  }[savingState];

  return (
    <aside
      aria-label="Ringkasan kurikulum"
      className="sticky top-4 flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
    >
      <h3 className="text-title-md text-on-surface">Ringkasan Kurikulum</h3>

      <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
        <div className="rounded-lg bg-surface-container-low p-3">
          <dt className="text-label-sm text-on-surface-variant">Modul</dt>
          <dd className="text-headline-md text-on-surface">{formatNumber(moduleCount)}</dd>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3">
          <dt className="text-label-sm text-on-surface-variant">Total Materi</dt>
          <dd className="text-headline-md text-on-surface">{formatNumber(materialCount)}</dd>
        </div>
        <div className="rounded-lg bg-tertiary-fixed p-3">
          <dt className="text-label-sm text-on-tertiary-fixed-variant">Total Poin</dt>
          <dd className="text-headline-md text-on-tertiary-fixed">{formatNumber(totalPoints)}</dd>
        </div>
      </dl>

      <p
        aria-live="polite"
        className="flex items-center gap-2 text-label-sm text-on-surface-variant"
      >
        <MaterialIcon
          name={
            savingState === 'error' ? 'error' : savingState === 'saving' ? 'sync' : 'cloud_done'
          }
          className={savingState === 'error' ? 'text-[16px] text-error' : 'text-[16px]'}
        />
        {savingLabel}
      </p>
    </aside>
  );
}
