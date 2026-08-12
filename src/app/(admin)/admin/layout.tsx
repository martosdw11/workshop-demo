import { redirect } from 'next/navigation';

import { AdminSideNav } from '@/components/shared/AdminSideNav';
import { getCurrentUser } from '@/server/auth/rbac';

/**
 * Route group `(admin)` — TDD §1.2 & §5.2.
 *
 * Peserta yang membuka `/admin/**` diarahkan ke dashboard-nya. Perhatikan bahwa
 * ini BUKAN pengganti guard di Route Handler: setiap endpoint `/api/v1/admin/**`
 * tetap memanggil `requireRole('admin')` sendiri (§5.3) — redirect di sini hanya
 * mengurus navigasi halaman.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <AdminSideNav user={{ name: user.name, email: user.email }} />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
