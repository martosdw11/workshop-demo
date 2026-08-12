'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { api } from '@/lib/api-client';
import { cn, initialsOf } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';

/**
 * AdminSideNav — TDD §6.2, mengikuti `admin_dashboard_monitoring` (w-64).
 *
 * Item Settings & Help ADA di mockup dan disebut §3.B.6 PRD, tetapi tidak punya
 * halaman di §3 maupun §1.3 TDD. Keduanya dirender sebagai item non-aktif
 * (`aria-disabled`) supaya rangka navigasi cocok dengan mockup tanpa menambah
 * halaman yang tidak ada di scope (aturan no scope creep).
 */
const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
  { href: '/admin/events', label: 'Event Management', icon: 'event_note' },
  { href: '/admin/participants', label: 'Participant List', icon: 'group' },
  { href: '/admin/users', label: 'User Access', icon: 'admin_panel_settings' },
];

const DISABLED_ITEMS = [
  { label: 'Settings', icon: 'settings' },
  { label: 'Help', icon: 'help' },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-label-md transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                )}
              >
                <MaterialIcon name={item.icon} filled={isActive} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="mt-auto flex flex-col gap-1 border-t border-outline-variant pt-4">
        {DISABLED_ITEMS.map((item) => (
          <li key={item.label}>
            <span
              aria-disabled="true"
              title="Belum tersedia pada MVP"
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-label-md text-on-surface-variant opacity-50"
            >
              <MaterialIcon name={item.icon} />
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export type AdminSideNavProps = {
  user: { name: string; email: string };
};

export function AdminSideNav({ user }: AdminSideNavProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  const header = (
    <div className="mb-8 flex items-center gap-4 px-2">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-title-lg text-primary">Admin Portal</p>
        <p className="truncate text-label-sm text-on-surface-variant">{user.email}</p>
      </div>
    </div>
  );

  const logoutButton = (
    <Button variant="ghost" className="mt-2 w-full justify-start" onClick={handleLogout} disabled={loggingOut}>
      <MaterialIcon name="logout" />
      {loggingOut ? 'Keluar…' : 'Keluar'}
    </Button>
  );

  return (
    <>
      {/* Desktop: sidebar tetap (portal admin diutamakan desktop, §2 PRD). */}
      <nav
        aria-label="Navigasi admin"
        className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-outline-variant bg-surface-container-lowest p-6 md:flex"
      >
        {header}
        <NavList />
        {logoutButton}
      </nav>

      {/* Mobile: sheet kiri, dipicu tombol menu di header halaman. */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-outline-variant bg-surface px-container-mobile py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Buka navigasi admin">
              <MaterialIcon name="menu" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Admin Portal</SheetTitle>
            </SheetHeader>
            <NavList onNavigate={() => setOpen(false)} />
            {logoutButton}
          </SheetContent>
        </Sheet>
        <span className="text-title-md text-primary">Learning Study AI</span>
      </div>
    </>
  );
}
