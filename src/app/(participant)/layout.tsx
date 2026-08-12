import { redirect } from 'next/navigation';

import { TopNavBar } from '@/components/shared/TopNavBar';
import { getCurrentUser } from '@/server/auth/rbac';

/**
 * Route group `(participant)` — TDD §1.2 & §5.2.
 *
 * Guard peran ditegakkan DI SERVER di sini, bukan di middleware: middleware
 * hanya memeriksa keberadaan cookie tanpa menyentuh database (optimasi, bukan
 * pengaman). Layout inilah yang benar-benar memvalidasi sesi ke tabel `sessions`.
 *
 * Admin yang membuka area peserta diarahkan ke portalnya sendiri, bukan diberi
 * 403 — ia memang tidak salah, hanya salah pintu.
 */
export const dynamic = 'force-dynamic';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'participant') redirect('/admin');

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar user={{ name: user.name, email: user.email }} totalPoints={user.totalPoints} />
      <div className="pt-16">{children}</div>
    </div>
  );
}
