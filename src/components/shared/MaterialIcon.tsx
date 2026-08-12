import { cn } from '@/lib/utils';

/**
 * Ikon Material Symbols Outlined — TDD §6.2.
 *
 * Fontnya di-self-host (`src/app/layout.tsx`), bukan diambil dari
 * fonts.googleapis.com seperti mockup: CSP produksi memakai `font-src 'self'`.
 *
 * Nama ikon dirender sebagai ligatur (teks di dalam span), karena itu
 * `aria-hidden` diberikan secara default — tanpa itu screen reader akan membaca
 * literal "check_circle". Pemanggil yang memakai ikon sebagai satu-satunya
 * penanda makna wajib mengirim `label`.
 */
export type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
  /** Bila diisi, ikon dianggap bermakna dan diumumkan screen reader. */
  label?: string;
};

export function MaterialIcon({ name, filled = false, className, label }: MaterialIconProps) {
  return (
    <span
      className={cn('material-symbols-outlined shrink-0 leading-none', className)}
      data-filled={filled ? 'true' : undefined}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      translate="no"
    >
      {name}
    </span>
  );
}
