import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { UserAccessTable } from '@/features/people/UserAccessTable';
import { PAGE_SIZE } from '@/lib/constants';
import { getCurrentUser } from '@/server/auth/rbac';

/**
 * User Access — PRD §3.B.11.
 *
 * `currentUserId` diteruskan ke tabel supaya kontrol untuk akun sendiri
 * di-disable sejak awal: guard `CANNOT_DEMOTE_SELF` / `CANNOT_DEACTIVATE_SELF`
 * (§5.3) tetap ditegakkan server, tapi admin tidak perlu menabraknya dulu untuk
 * tahu bahwa aksinya tidak diizinkan.
 */
export const metadata: Metadata = { title: 'User Access — Learning Study AI' };
export const dynamic = 'force-dynamic';

export default async function UserAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const status = params.status === 'active' || params.status === 'inactive' ? params.status : 'all';

  return (
    <div className="px-container-mobile py-6 md:px-container-desktop">
      <div className="mb-6">
        <h1 className="mb-1 text-headline-lg-mobile text-on-surface md:text-headline-lg">
          User Access
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          Kelola peran, status akun, dan reset password.
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <UserAccessTable
          key={`${q}:${status}`}
          currentUserId={user.id}
          q={q}
          status={status}
          rowsPerPage={PAGE_SIZE.participants}
        />
      </Suspense>
    </div>
  );
}
