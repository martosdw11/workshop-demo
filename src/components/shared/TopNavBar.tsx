'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { cn, initialsOf } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';
import { ThemeToggle } from './ThemeToggle';

/**
 * TopNavBar — TDD §6.2, mengikuti `header` fixed h-16 pada seluruh mockup peserta.
 *
 * Badge **Total Points** muncul di setiap halaman peserta; angkanya datang dari
 * `users.total_points` yang sudah didenormalisasi (TDD §2.2), diteruskan layout
 * sebagai prop — BUKAN di-fetch ulang per halaman.
 *
 * Kolom "Search events…" pada mockup SENGAJA tidak dibawa ke navbar: pencarian
 * event adalah bagian `CatalogFilterBar` yang tersinkron ke URL search params
 * (§6.5). Dua kotak pencarian dengan sumber state berbeda akan saling
 * bertentangan; ini dicatat sebagai penyimpangan sadar dari mockup.
 */
export type TopNavBarProps = {
  user: { name: string; email: string };
  totalPoints: number;
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/catalog', label: 'Event Catalog' },
];

export function TopNavBar({ user, totalPoints }: TopNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } finally {
      // Selalu pulang ke /login walau request gagal: cookie mungkin sudah tidak
      // valid, dan menahan pengguna di halaman terproteksi tidak membantu.
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-outline-variant bg-surface">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex h-full max-w-7xl items-center gap-6 px-container-mobile md:px-container-desktop"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg text-title-lg text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MaterialIcon name="school" filled className="text-[28px]" />
          <span className="hidden sm:inline">Learning Study AI</span>
        </Link>

        <div className="hidden gap-4 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'pb-1 text-label-md transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-on-surface-variant hover:text-primary',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-2 rounded-full bg-primary-container px-3 py-1.5 text-label-md text-on-primary-container"
            aria-label={`Total poin ${formatNumber(totalPoints)}`}
          >
            <MaterialIcon name="stars" filled className="text-[16px]" />
            <span className="hidden sm:inline">Total Points:&nbsp;</span>
            {formatNumber(totalPoints)}
          </span>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label="Menu akun"
              >
                <Avatar className="border border-outline-variant">
                  <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
              <div className="px-3 pb-2 text-body-sm text-on-surface-variant">{user.email}</div>
              <DropdownMenuSeparator />
              {/* Di mobile mockup menyembunyikan link nav; agar tetap terjangkau,
                  keduanya pindah ke menu akun — bukan menambah baris kedua yang
                  akan merusak tinggi header 64px. */}
              <div className="md:hidden">
                {NAV_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>
                      <MaterialIcon name={item.href === '/dashboard' ? 'dashboard' : 'library_books'} />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
              <DropdownMenuItem onSelect={handleLogout} disabled={loggingOut}>
                <MaterialIcon name="logout" />
                {loggingOut ? 'Keluar…' : 'Keluar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
