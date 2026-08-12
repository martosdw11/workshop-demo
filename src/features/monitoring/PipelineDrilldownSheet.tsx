'use client';

import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { MaterialDrilldownItemData, PipelineItemData } from './types';

/**
 * PipelineDrilldownSheet — TDD §6.8 & PRD §3.B.6.
 *
 * Query **on-demand**: ia berjalan hanya saat sheet terbuka (`enabled`), dan
 * TIDAK ikut polling 30 detik (§7.3 menandainya "on-demand"). Sebaran per materi
 * jauh lebih mahal daripada ringkasan pipeline, dan tidak ada gunanya menyegarkan
 * data untuk panel yang tertutup.
 *
 * Yang ditampilkan persis contoh PRD: "Materi 3.2 — 42 peserta".
 */
export function PipelineDrilldownSheet({
  event,
  open,
  onOpenChange,
}: {
  event: PipelineItemData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const eventId = event?.eventId ?? 0;

  const { data, error, isPending, refetch } = useQuery({
    queryKey: qk.admin.dashboard.drilldown(eventId),
    queryFn: () =>
      api.get<{ items: MaterialDrilldownItemData[]; generatedAt: string }>(
        `/admin/events/${eventId}/pipeline/materials`,
      ),
    enabled: open && eventId > 0,
  });

  const maxCount = Math.max(1, ...(data?.items.map((item) => item.participantCount) ?? [1]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{event?.title ?? 'Sebaran peserta'}</SheetTitle>
          <SheetDescription>
            Jumlah peserta yang sedang berada di tiap materi, beserta yang sudah menyelesaikannya.
          </SheetDescription>
        </SheetHeader>

        {isPending && open ? (
          <ListSkeleton count={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon="account_tree"
            title="Belum ada materi"
            description="Event ini belum memiliki materi, sehingga sebaran peserta belum bisa dihitung."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {data?.items.map((item) => (
              <li
                key={item.materialId}
                className={cn(
                  'rounded-lg p-3 transition-colors hover:bg-surface-container-low',
                  item.depth === 1 && 'ml-4',
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-label-md text-on-surface">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-label-sm text-on-surface-variant">
                    {formatNumber(item.participantCount)} peserta
                  </span>
                </div>

                {/* Bar relatif terhadap materi terpadat — titik penumpukan
                    (bottleneck) langsung terlihat tanpa membaca angka. */}
                <div className="h-progress w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${(item.participantCount / maxCount) * 100}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <MaterialIcon name="task_alt" className="text-[14px]" />
                    {formatNumber(item.completedCount)} selesai
                  </span>
                  {item.openIssueCount > 0 && (
                    <Badge variant="issue">
                      <MaterialIcon name="report_problem" className="text-[14px]" />
                      {formatNumber(item.openIssueCount)} issue terbuka
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
