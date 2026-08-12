import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/rbac';

/**
 * Root: pengalih berdasarkan peran. Middleware sudah melempar pengunjung tanpa
 * cookie ke `/login`; yang sampai ke sini punya cookie — tapi cookie belum tentu
 * sesi yang valid, jadi validasinya tetap dilakukan di sini.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.role === 'admin' ? '/admin' : '/dashboard');
}
