import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * ParticipantKpiGrid — TDD §6.4: 4 kartu dengan ikon `library_books`, `bolt`,
 * `task_alt`, `workspace_premium`.
 *
 * Warna ikon mengikuti semantik §6.1: poin memakai token `tertiary`, status
 * selesai memakai `secondary`. Angkanya `headline-md` seperti mockup.
 */
export type ParticipantKpiGridProps = {
  totalJoined: number;
  active: number;
  completed: number;
  totalPoints: number;
};

export function ParticipantKpiGrid({
  totalJoined,
  active,
  completed,
  totalPoints,
}: ParticipantKpiGridProps) {
  const cards = [
    {
      label: 'Total Events Joined',
      value: totalJoined,
      icon: 'library_books',
      iconClass: 'bg-surface-container-high text-primary',
    },
    {
      label: 'Active Events',
      value: active,
      icon: 'bolt',
      iconClass: 'bg-primary-container text-on-primary-container',
    },
    {
      label: 'Completed Events',
      value: completed,
      icon: 'task_alt',
      iconClass: 'bg-surface-container-high text-secondary',
    },
    {
      label: 'Total Points',
      value: totalPoints,
      icon: 'workspace_premium',
      iconClass: 'bg-tertiary-container text-on-tertiary-container',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col items-start rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
        >
          <span className={cn('mb-3 rounded-lg p-2', card.iconClass)}>
            <MaterialIcon name={card.icon} filled={card.icon === 'workspace_premium'} />
          </span>
          <span className="mb-1 text-label-sm text-on-surface-variant">{card.label}</span>
          <span className="text-headline-md text-on-surface">{formatNumber(card.value)}</span>
        </div>
      ))}
    </div>
  );
}
