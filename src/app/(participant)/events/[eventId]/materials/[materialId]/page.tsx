import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { EmptyState } from '@/components/shared/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { LearningPathSidebar } from '@/features/player/LearningPathSidebar';
import { MaterialContent } from '@/features/player/MaterialContent';
import { MaterialHeader } from '@/features/player/MaterialHeader';
import { PlayerFooterNav } from '@/features/player/PlayerFooterNav';
import { ResponsePanel } from '@/features/player/ResponsePanel';
import type { PathNodeData } from '@/features/player/types';
import { formatMaterialOverline } from '@/lib/format';
import { cn, initialsOf } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/rbac';
import { isAppError } from '@/server/http/errors';
import { getEnrollmentDetail, getMaterialForParticipant } from '@/server/services/learning.service';
import { getCatalogEvent } from '@/server/services/catalog.service';

/**
 * Learning Player — PRD §3.A.4, acuan `learning_player_material_view/`.
 *
 * Strategi render §1.2: **konten materi Dynamic RSC** (stabil, dibaca lewat
 * service layer), **panel respons lewat TanStack Query di client** (berubah
 * terus, butuh optimistic update).
 *
 * PENGUNCIAN: materi terkunci ditolak SERVER lewat `403 MATERIAL_LOCKED`; di
 * sini `AppError` itu ditangkap dan dirender sebagai state terkunci. Aturannya
 * bukan "sembunyikan tombolnya" — URL langsung pun tidak bisa menembusnya.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Materi — Learning Study AI' };

/** Overline "Modul X • Lesson Y" dihitung dari posisi materi di dalam tree. */
function overlineFor(path: PathNodeData[], materialId: number): string {
  for (let moduleIndex = 0; moduleIndex < path.length; moduleIndex += 1) {
    const node = path[moduleIndex];
    if (node.id === materialId) return formatMaterialOverline(moduleIndex + 1);
    const lessonIndex = node.children.findIndex((child) => child.id === materialId);
    if (lessonIndex >= 0) return formatMaterialOverline(moduleIndex + 1, lessonIndex + 1);
  }
  return '';
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ eventId: string; materialId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { eventId: rawEventId, materialId: rawMaterialId } = await params;
  const eventId = Number(rawEventId);
  const materialId = Number(rawMaterialId);
  if (!Number.isInteger(eventId) || !Number.isInteger(materialId)) notFound();

  let material: Awaited<ReturnType<typeof getMaterialForParticipant>>;
  try {
    material = await getMaterialForParticipant(materialId, user);
  } catch (error) {
    if (isAppError(error) && error.code === 'MATERIAL_LOCKED') {
      const { myEnrollment } = await getCatalogEvent(user.id, eventId);
      return (
        <div className="mx-auto max-w-3xl px-container-mobile py-16 md:px-container-desktop">
          <EmptyState
            icon="lock"
            title="Materi ini masih terkunci"
            description="Selesaikan materi sebelumnya terlebih dahulu."
            action={
              <Link
                href={
                  myEnrollment?.resumeUrl ?? (myEnrollment ? `/events/${eventId}` : '/catalog')
                }
                className={cn(buttonVariants({ variant: 'primary' }))}
              >
                Kembali ke materi aktif
              </Link>
            }
          />
        </div>
      );
    }
    if (isAppError(error) && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const detail = await getEnrollmentDetail(material.enrollmentId, user);
  const path = detail.path as PathNodeData[];

  return (
    <div className="flex flex-col lg:flex-row">
      <LearningPathSidebar
        eventId={eventId}
        eventTitle={detail.enrollment.eventTitle}
        path={path}
        activeMaterialId={materialId}
        progressPercent={detail.progressPercent}
        completedCount={detail.enrollment.completedMaterialCount}
        totalCount={detail.enrollment.materialsTotal}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-surface-container-lowest">
        <div className="mx-auto w-full max-w-5xl flex-1 px-container-mobile py-8 md:px-container-desktop">
          <MaterialHeader
            overline={overlineFor(path, materialId)}
            title={material.material.title}
            points={material.material.points}
            pointsEarned={material.pointsEarned}
          />

          <MaterialContent html={material.material.contentHtml} />

          <ResponsePanel
            materialId={materialId}
            enrollmentId={material.enrollmentId}
            readOnly={material.isReadOnly}
            author={{ id: user.id, name: user.name, initials: initialsOf(user.name) }}
            completedAt={detail.enrollment.completedAt}
            totalPoints={detail.enrollment.totalPoints}
            resultHref={`/events/${eventId}/result`}
          />
        </div>

        <PlayerFooterNav
          eventId={eventId}
          enrollmentId={material.enrollmentId}
          materialId={materialId}
          prevId={material.prevId}
          nextId={material.nextId}
          isLast={material.isLast}
          readOnly={material.isReadOnly}
          summary={{
            eventTitle: detail.enrollment.eventTitle,
            completedMaterialCount: detail.enrollment.completedMaterialCount,
            materialsTotal: detail.enrollment.materialsTotal,
            totalPoints: detail.enrollment.totalPoints,
            pointsAvailable: detail.enrollment.pointsAvailable,
          }}
        />
      </main>
    </div>
  );
}
