import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/shared/EmptyState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { MaterialContent } from '@/features/player/MaterialContent';
import { MaterialHeader } from '@/features/player/MaterialHeader';
import { EventDetailTabs } from '@/features/people/EventDetailTabs';
import { formatMaterialOverline } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isAppError } from '@/server/http/errors';
import { getAdminEventDetail } from '@/server/services/event.service';
import { getEventTree } from '@/server/services/material.service';

/**
 * Tab **Preview** — PRD §3.B.8: menampilkan event persis seperti yang akan
 * dilihat peserta, memakai layout Learning Player dalam **mode baca saja**.
 *
 * Yang membedakannya dari Learning Player peserta: tidak ada `ResponsePanel`
 * (tidak ada composer maupun timeline) dan tidak ada `PlayerFooterNav`. Preview
 * adalah pemeriksaan konten oleh admin, bukan simulasi keikutsertaan — admin
 * tidak punya enrollment, jadi tidak ada progres atau poin yang bisa ditulis.
 */
export const metadata: Metadata = { title: 'Preview Event — Learning Study AI' };
export const dynamic = 'force-dynamic';

export default async function EventPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  try {
    const [detail, tree] = await Promise.all([getAdminEventDetail(eventId), getEventTree(eventId)]);

    return (
      <div className="px-container-mobile py-6 md:px-container-desktop">
        <h1 className="mb-4 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          {detail.event.title}
        </h1>

        <EventDetailTabs eventId={eventId} />

        <p className="mb-6 flex items-start gap-2 rounded-lg border border-secondary-fixed-dim bg-secondary-fixed/40 px-4 py-3 text-body-sm text-on-secondary-fixed">
          <MaterialIcon name="visibility" className="text-[18px]" />
          Mode baca saja — panel respons peserta tidak ditampilkan di preview.
        </p>

        {tree.tree.length === 0 ? (
          <EmptyState
            icon="account_tree"
            title="Event ini belum memiliki materi"
            description="Tambahkan materi lewat Event Builder sebelum mempublikasikan event."
          />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Sidebar kurikulum versi statis: tanpa state peserta (semua terbuka). */}
            <aside className="w-full shrink-0 rounded-lg border border-outline-variant bg-surface-container-low p-4 lg:w-72">
              <h2 className="mb-3 text-title-md text-on-surface">Learning Path</h2>
              <ol className="flex flex-col gap-1">
                {tree.tree.map((module, moduleIndex) => (
                  <li key={module.id}>
                    <a
                      href={`#material-${module.id}`}
                      className="block rounded-lg px-2 py-2 text-body-sm text-on-surface-variant hover:bg-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    >
                      {moduleIndex + 1}. {module.title}
                    </a>
                    {module.children.length > 0 && (
                      <ol className="flex flex-col gap-1">
                        {module.children.map((lesson, lessonIndex) => (
                          <li key={lesson.id}>
                            <a
                              href={`#material-${lesson.id}`}
                              className="block rounded-lg py-2 pl-6 pr-2 text-body-sm text-on-surface-variant hover:bg-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            >
                              {moduleIndex + 1}.{lessonIndex + 1} {lesson.title}
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            </aside>

            <main className="min-w-0 flex-1">
              {tree.tree.map((module, moduleIndex) => (
                <section key={module.id} className="mb-12">
                  <div id={`material-${module.id}`} className="scroll-mt-20">
                    <MaterialHeader
                      overline={formatMaterialOverline(moduleIndex + 1)}
                      title={module.title}
                      points={module.points}
                      pointsEarned={null}
                    />
                    <MaterialContent html={module.contentHtml} />
                  </div>

                  {module.children.map((lesson, lessonIndex) => (
                    <div
                      key={lesson.id}
                      id={`material-${lesson.id}`}
                      className={cn('scroll-mt-20 border-l-4 border-outline-variant pl-6')}
                    >
                      <MaterialHeader
                        overline={formatMaterialOverline(moduleIndex + 1, lessonIndex + 1)}
                        title={lesson.title}
                        points={lesson.points}
                        pointsEarned={null}
                      />
                      <MaterialContent html={lesson.contentHtml} />
                    </div>
                  ))}
                </section>
              ))}
            </main>
          </div>
        )}
      </div>
    );
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
}
