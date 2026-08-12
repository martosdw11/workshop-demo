import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/rbac';
import { getCatalogEvent } from '@/server/services/catalog.service';

/**
 * `/events/:eventId` — pengalih ke posisi terakhir peserta (TDD §1.3).
 *
 * Belum ikut  → kembali ke katalog (join hanya sah lewat `JoinConfirmDialog`,
 *               karena konfirmasi itulah yang membuat record keikutsertaan).
 * Sedang ikut → materi terakhir (`current_material_id`).
 * Selesai     → halaman View Results.
 */
export const dynamic = 'force-dynamic';

export default async function EventEntryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const { myEnrollment } = await getCatalogEvent(user.id, eventId);

  if (!myEnrollment) redirect('/catalog');
  if (myEnrollment.status === 'completed') redirect(`/events/${eventId}/result`);
  if (myEnrollment.currentMaterialId) {
    redirect(`/events/${eventId}/materials/${myEnrollment.currentMaterialId}`);
  }

  // Enrollment ada tapi event belum punya materi sama sekali.
  redirect('/catalog');
}
