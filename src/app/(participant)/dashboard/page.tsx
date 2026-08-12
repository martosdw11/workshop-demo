import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/shared/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { AchievementHistoryList } from '@/features/dashboard/AchievementHistoryList';
import { ContinueLearningCard } from '@/features/dashboard/ContinueLearningCard';
import { ParticipantKpiGrid } from '@/features/dashboard/ParticipantKpiGrid';
import { WelcomeHeader } from '@/features/dashboard/WelcomeHeader';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/rbac';
import { getParticipantDashboard } from '@/server/services/learning.service';
import Link from 'next/link';

/**
 * Dashboard Peserta — PRD §3.A.2, acuan `participant_dashboard/`.
 *
 * Strategi render §1.2: **Dynamic RSC, query langsung via service layer**.
 * Datanya personal sehingga tidak bisa di-cache lintas user, dan memanggil
 * service langsung menghemat satu HTTP hop dibanding lewat `/api/v1/me/dashboard`
 * (A-03 mengizinkan ini khusus Server Component).
 */
export const metadata: Metadata = { title: 'Dashboard — Learning Study AI' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const data = await getParticipantDashboard(user);

  return (
    <main className="mx-auto max-w-7xl px-container-mobile py-8 md:px-container-desktop">
      <WelcomeHeader name={user.name.split(' ')[0]} />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="flex flex-col gap-gutter lg:col-span-2">
          {data.continueLearning ? (
            <ContinueLearningCard
              event={data.continueLearning}
              progressPercent={data.continueLearning.progressPercent}
            />
          ) : (
            <EmptyState
              icon="play_circle"
              title="Belum ada event yang sedang berjalan"
              description="Pilih event di katalog untuk mulai belajar dan mengumpulkan poin."
              action={
                <Link href="/catalog" className={cn(buttonVariants({ variant: 'primary' }))}>
                  Buka Event Catalog
                </Link>
              }
            />
          )}

          <ParticipantKpiGrid
            totalJoined={data.kpi.totalEventsJoined}
            active={data.kpi.activeEvents}
            completed={data.kpi.completedEvents}
            totalPoints={data.kpi.totalPoints}
          />
        </div>

        <AchievementHistoryList items={data.achievements} />
      </div>
    </main>
  );
}
