import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { cn } from '@/lib/utils';

/**
 * PointsBadge — TDD §6.6: pill `+50 Points`.
 * `earned` menandai materi yang poinnya SUDAH diraih (ada `material_progress`),
 * dibedakan dari poin yang baru "tersedia".
 */
export function PointsBadge({
  points,
  earned = false,
  className,
}: {
  points: number;
  earned?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-label-md',
        earned
          ? 'border-tertiary-fixed-dim bg-tertiary-fixed text-on-tertiary-fixed'
          : 'border-primary-fixed-dim bg-surface-container-high text-primary',
        className,
      )}
    >
      <MaterialIcon name="star" filled={earned} className="text-[18px]" />
      {earned ? `${points} Points diraih` : `+${points} Points`}
    </span>
  );
}

/**
 * MaterialHeader — TDD §6.6. Overline "Modul X • Lesson Y" memakai `label-sm`
 * uppercase dengan token `secondary`, persis mockup.
 */
export function MaterialHeader({
  overline,
  title,
  points,
  pointsEarned,
}: {
  overline: string;
  title: string;
  points: number;
  pointsEarned: number | null;
}) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-4 border-b border-outline-variant pb-6 sm:flex-row sm:items-start">
      <div>
        <p className="mb-2 text-label-sm uppercase text-secondary">{overline}</p>
        <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{title}</h1>
      </div>
      {points > 0 && (
        <PointsBadge
          points={pointsEarned !== null && pointsEarned > 0 ? pointsEarned : points}
          earned={pointsEarned !== null && pointsEarned > 0}
          className="shrink-0 self-start"
        />
      )}
    </header>
  );
}
