import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ActivityFeed } from '@/features/monitoring/ActivityFeed';
import { EventPipelineChart } from '@/features/monitoring/EventPipelineChart';
import { KpiGrid } from '@/features/monitoring/KpiGrid';
import { EventFilter, PeriodFilter } from '@/features/monitoring/PeriodFilter';
import { DASHBOARD_PERIODS, PAGE_SIZE, type DashboardPeriod } from '@/lib/constants';
import { listAdminEvents } from '@/server/services/event.service';
import { getDashboardKpi, getPipelineSummary } from '@/server/services/stats.service';

/**
 * Admin Dashboard & Monitoring — PRD §3.B.6, acuan `admin_dashboard_monitoring/`.
 *
 * Angka pertama dirender server (service layer + `unstable_cache` 30 detik,
 * §1.2), lalu komponen klien mengambil alih dengan **polling 30 detik** (§7.3).
 * Tidak ada WebSocket: yang butuh data segar hanya beberapa admin, dan koneksi
 * persisten untuk itu tidak sepadan (§7.3).
 */
export const metadata: Metadata = { title: 'Dashboard Admin — Learning Study AI' };
export const dynamic = 'force-dynamic';

function parsePeriod(value: string | undefined): DashboardPeriod {
  return DASHBOARD_PERIODS.includes(value as DashboardPeriod)
    ? (value as DashboardPeriod)
    : '30d';
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; eventId?: string }>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const parsedEventId = Number(params.eventId);
  const eventId = Number.isInteger(parsedEventId) && parsedEventId > 0 ? parsedEventId : null;

  const [kpi, pipeline, events] = await Promise.all([
    getDashboardKpi(period),
    getPipelineSummary({ period, eventId: eventId ?? undefined }),
    listAdminEvents({ status: 'all', q: undefined, cursor: undefined, limit: PAGE_SIZE.adminEvents }),
  ]);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-outline-variant bg-surface/90 px-container-mobile py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:px-container-desktop">
        <div>
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">Overview</h1>
          <p className="text-body-sm text-on-surface-variant">
            Performa sistem dan analitik event.
          </p>
        </div>

        <Suspense fallback={null}>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodFilter value={period} />
            <EventFilter
              value={eventId}
              options={events.items.map((item) => ({ id: item.id, title: item.title }))}
            />
          </div>
        </Suspense>
      </header>

      <div className="flex flex-col gap-8 px-container-mobile py-6 md:px-container-desktop">
        <KpiGrid period={period} initialData={kpi} />

        <div className="grid grid-cols-1 gap-gutter xl:grid-cols-3">
          <div className="xl:col-span-2">
            <EventPipelineChart period={period} eventId={eventId} initialData={pipeline} />
          </div>
          <ActivityFeed eventId={eventId} />
        </div>
      </div>
    </div>
  );
}
