import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { buttonVariants } from '@/components/ui/button';
import type { PathNodeData } from '@/features/player/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/rbac';
import { getCatalogEvent } from '@/server/services/catalog.service';
import { getEnrollmentDetail } from '@/server/services/learning.service';

/**
 * View Results — PRD §4.1 langkah 10, tujuan `redirectTo` dari endpoint finish.
 *
 * Halaman ini murni baca: ia menampilkan rincian poin per materi yang sudah
 * dikunci. Tidak ada satu pun aksi mutasi di sini — itulah bentuk konkret dari
 * "seluruh input pada event tersebut menjadi read-only" (§2 PRD).
 */
export const metadata: Metadata = { title: 'Hasil Event — Learning Study AI' };
export const dynamic = 'force-dynamic';

function flatten(path: PathNodeData[]): PathNodeData[] {
  return path.flatMap((node) => [node, ...node.children]);
}

export default async function EventResultPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const { event, myEnrollment } = await getCatalogEvent(user.id, eventId);
  if (!myEnrollment) redirect('/catalog');

  const detail = await getEnrollmentDetail(myEnrollment.id, user);
  const rows = flatten(detail.path as PathNodeData[]);

  const isCompleted = detail.enrollment.status === 'completed';

  return (
    <main className="mx-auto max-w-5xl px-container-mobile py-8 md:px-container-desktop">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1 rounded text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          Kembali ke Event Catalog
        </Link>
      </nav>

      <header className="mb-8 rounded-lg border border-outline-variant bg-surface-container-lowest p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-label-sm uppercase text-secondary">
              {isCompleted ? 'Event selesai' : 'Ringkasan progres'}
            </p>
            <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">
              {event.title}
            </h1>
            {detail.enrollment.completedAt && (
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Diselesaikan {formatDateTime(detail.enrollment.completedAt)}
              </p>
            )}
          </div>

          <span className="flex items-center gap-2 rounded-full bg-tertiary-fixed px-4 py-2 text-title-md text-on-tertiary-fixed">
            <MaterialIcon name="workspace_premium" filled />
            {formatNumber(detail.enrollment.totalPoints)} /{' '}
            {formatNumber(detail.enrollment.pointsAvailable)} poin
          </span>
        </div>

        <div className="mb-1 flex justify-between text-label-sm text-on-surface-variant">
          <span>
            {detail.enrollment.completedMaterialCount} dari {detail.enrollment.materialsTotal} materi
            selesai
          </span>
          <span>{detail.progressPercent}%</span>
        </div>
        <ProgressBar value={detail.progressPercent} label={`Progres ${event.title}`} />
      </header>

      <section aria-labelledby="score-detail-title">
        <h2 id="score-detail-title" className="mb-4 text-title-lg text-on-surface">
          Rincian poin per materi
        </h2>

        <ul className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          {rows.map((node) => (
            <li
              key={node.id}
              className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-3 last:border-0"
            >
              <span className={cn('flex min-w-0 items-center gap-2', node.depth === 1 && 'pl-6')}>
                <MaterialIcon
                  name={node.state === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                  filled={node.state === 'completed'}
                  className={cn(
                    'text-[18px]',
                    node.state === 'completed' ? 'text-primary' : 'text-outline',
                  )}
                />
                <span className="truncate text-body-sm text-on-surface">{node.title}</span>
              </span>

              <span className="shrink-0 text-label-sm text-on-surface-variant">
                {node.pointsEarned !== null
                  ? `${formatNumber(node.pointsEarned)} / ${formatNumber(node.points)} poin`
                  : `0 / ${formatNumber(node.points)} poin`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'primary' }))}>
          Kembali ke Dashboard
        </Link>
        {detail.enrollment.currentMaterialId && (
          <Link
            href={`/events/${eventId}/materials/${detail.enrollment.currentMaterialId}`}
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            <MaterialIcon name="menu_book" />
            Baca ulang materi
          </Link>
        )}
      </div>
    </main>
  );
}
