import { cn } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';

/**
 * State kosong. Aturan epic ini: tidak boleh ada layar putih tanpa penjelasan —
 * daftar kosong selalu menerangkan MENGAPA kosong dan apa langkah berikutnya.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant',
        'bg-surface-container-low px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <MaterialIcon name={icon} className="text-[24px]" />
      </span>
      <p className="text-title-md text-on-surface">{title}</p>
      {description && <p className="max-w-md text-body-sm text-on-surface-variant">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
