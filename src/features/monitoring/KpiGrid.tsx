'use client';

import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/shared/ErrorState';
import { KpiGridSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { api } from '@/lib/api-client';
import type { DashboardPeriod } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { MONITORING_POLL_MS, type DashboardKpiData } from './types';

/**
 * KpiCard + KpiGrid — TDD §6.8: Total Events Generated, Events Active Today,
 * Upcoming Weekly Events, Total Participants.
 *
 * Nilai awal datang dari Server Component (`initialData`), lalu di-refresh
 * `refetchInterval` 30 detik (§7.3) — bukan polling agresif, karena angkanya
 * sendiri di-cache 30 detik di server.
 */
export function KpiCard({
  label,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <span className={cn('mb-3 rounded-lg p-2', iconClass)}>
        <MaterialIcon name={icon} filled />
      </span>
      <span className="mb-1 text-label-sm text-on-surface-variant">{label}</span>
      <span className="text-display text-on-surface">{formatNumber(value)}</span>
    </div>
  );
}

export function KpiGrid({
  period,
  initialData,
}: {
  period: DashboardPeriod;
  initialData: DashboardKpiData;
}) {
  const { data, error, refetch } = useQuery({
    queryKey: qk.admin.dashboard.kpi(period),
    queryFn: () => api.get<DashboardKpiData>('/admin/dashboard/kpi', { query: { period } }),
    refetchInterval: MONITORING_POLL_MS,
    initialData,
  });

  if (error && !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <KpiGridSkeleton />;

  const cards = [
    {
      label: 'Total Events Generated',
      value: data.totalEvents,
      icon: 'event_note',
      iconClass: 'bg-surface-container-high text-primary',
    },
    {
      label: 'Events Active Today',
      value: data.activeToday,
      icon: 'bolt',
      iconClass: 'bg-primary-container text-on-primary-container',
    },
    {
      label: 'Upcoming Weekly Events',
      value: data.upcomingWeek,
      icon: 'upcoming',
      iconClass: 'bg-surface-container-high text-secondary',
    },
    {
      label: 'Total Participants',
      value: data.totalParticipants,
      icon: 'group',
      iconClass: 'bg-tertiary-container text-on-tertiary-container',
    },
  ];

  return (
    <section aria-label="Ringkasan KPI" className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  );
}
