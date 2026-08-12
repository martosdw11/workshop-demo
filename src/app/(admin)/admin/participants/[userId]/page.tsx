import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ParticipantDetailPanel } from '@/features/people/ParticipantDetailPanel';
import type { ParticipantEnrollment, ParticipantProfile } from '@/features/people/types';
import { isAppError } from '@/server/http/errors';
import { getParticipantDetail } from '@/server/services/user.service';

/** Detail Peserta — PRD §3.B.10. */
export const metadata: Metadata = { title: 'Detail Peserta — Learning Study AI' };
export const dynamic = 'force-dynamic';

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: rawUserId } = await params;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  try {
    const detail = await getParticipantDetail(userId);

    return (
      <div className="px-container-mobile py-6 md:px-container-desktop">
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/admin/participants"
            className="inline-flex items-center gap-1 rounded text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <MaterialIcon name="arrow_back" className="text-[18px]" />
            Kembali ke Participant List
          </Link>
        </nav>

        <ParticipantDetailPanel
          profile={detail.profile as ParticipantProfile}
          enrollments={detail.enrollments as ParticipantEnrollment[]}
        />
      </div>
    );
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
}
