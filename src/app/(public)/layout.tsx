import { AuthSplitLayout } from '@/features/auth/AuthSplitLayout';

/**
 * Route group `(public)` — TDD §1.2: **static, tanpa akses DB**.
 *
 * Ini halaman yang paling sering dihantam saat pembukaan event (150 login dalam
 * 2 menit), jadi ia sengaja tidak memanggil `getCurrentUser()`. Pengguna yang
 * sudah login dan membuka `/login` akan tetap melihat form; setelah submit,
 * server mengarahkannya sesuai peran.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplitLayout>{children}</AuthSplitLayout>;
}
