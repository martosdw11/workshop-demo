'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { api } from '@/lib/api-client';
import type { DashboardPeriod } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { PipelineDrilldownSheet } from './PipelineDrilldownSheet';
import { MONITORING_POLL_MS, type PipelineItemData } from './types';

/**
 * PipelineBar — TDD §6.8: stacked bar `h-6 rounded-full` dengan tiga segmen.
 *
 * Warna dikunci klasifikasi §7.5:
 *   Completed   → `primary`
 *   In Progress → `secondary`
 *   Stalled     → `error/80`  (aktivitas terakhir > 3 hari)
 *
 * Bar-nya adalah tombol: mengkliknya membuka drill-down (§6.8). Karena itu ia
 * `<button>` sungguhan, bukan `<div onClick>` — supaya bisa ditab dan ditekan
 * Enter/Space tanpa kode tambahan.
 */
export function PipelineBar({
  item,
  onSelect,
}: {
  item: PipelineItemData;
  onSelect: (item: PipelineItemData) => void;
}) {
  const total = Math.max(1, item.total);
  const percent = (value: number) => `${(value / total) * 100}%`;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={`Lihat sebaran peserta pada event ${item.title}`}
      className="w-full rounded-lg p-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="truncate text-title-md text-on-surface">{item.title}</span>
        <span className="text-label-sm text-on-surface-variant">
          {formatNumber(item.total)} peserta
        </span>
      </div>

      <div className="flex h-6 w-full overflow-hidden rounded-full bg-surface-container-high">
        <span className="bg-primary" style={{ width: percent(item.completed) }} />
        <span className="bg-secondary" style={{ width: percent(item.inProgress) }} />
        <span className="bg-error/80" style={{ width: percent(item.stalled) }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-primary" />
          Completed {formatNumber(item.completed)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-secondary" />
          In Progress {formatNumber(item.inProgress)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-error/80" />
          Stalled {formatNumber(item.stalled)}
        </span>
      </div>
    </button>
  );
}

export function EventPipelineChart({
  period,
  eventId,
  initialData,
}: {
  period: DashboardPeriod;
  eventId: number | null;
  initialData: PipelineItemData[];
}) {
  const [selected, setSelected] = React.useState<PipelineItemData | null>(null);

  const { data, error, refetch, isPending } = useQuery({
    queryKey: qk.admin.dashboard.pipeline(period, eventId ?? undefined),
    queryFn: () =>
      api.get<{ items: PipelineItemData[] }>('/admin/dashboard/pipeline', {
        query: { period, eventId: eventId ?? undefined },
      }),
    refetchInterval: MONITORING_POLL_MS,
    initialData: { items: initialData },
  });

  return (
    <section
      aria-labelledby="pipeline-title"
      className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 md:p-6"
    >
      <div className="mb-4">
        <h2 id="pipeline-title" className="text-title-lg text-on-surface">
          Event Pipeline Summary
        </h2>
        <p className="text-body-sm text-on-surface-variant">
          Klik sebuah bar untuk melihat sebaran peserta per materi.
        </p>
      </div>

      {isPending ? (
        <ListSkeleton count={3} />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon="insights"
          title="Belum ada data pipeline"
          description="Pipeline muncul setelah ada peserta yang bergabung ke event terpublikasi."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data?.items.map((item) => (
            <PipelineBar key={item.eventId} item={item} onSelect={setSelected} />
          ))}
        </div>
      )}

      <PipelineDrilldownSheet
        event={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </section>
  );
}
