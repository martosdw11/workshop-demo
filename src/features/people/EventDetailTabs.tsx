'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { cn } from '@/lib/utils';

/**
 * Tiga tab Detail Event admin — PRD §3.B.8: **Preview**, **Peserta & Nilai**,
 * **Respons**.
 *
 * Tab diimplementasikan sebagai TAUTAN, bukan state lokal: masing-masing punya
 * halaman sendiri di §1.3 TDD (`preview/`, `participants/`, `responses/`),
 * sehingga URL-nya bisa dibagikan dan filter di dalam tab tetap hidup di URL.
 */
const TABS = [
  { segment: 'preview', label: 'Preview', icon: 'visibility' },
  { segment: 'participants', label: 'Peserta & Nilai', icon: 'grade' },
  { segment: 'responses', label: 'Respons', icon: 'forum' },
];

export function EventDetailTabs({ eventId }: { eventId: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Tab detail event" className="mb-6 flex flex-wrap gap-1 border-b border-outline-variant">
      {TABS.map((tab) => {
        const href = `/admin/events/${eventId}/${tab.segment}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-t-lg px-4 py-2 text-label-md transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
              isActive
                ? 'border-b-2 border-primary bg-surface-container-high text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            <MaterialIcon name={tab.icon} filled={isActive} />
            {tab.label}
          </Link>
        );
      })}

      <Link
        href={`/admin/events/${eventId}/edit`}
        className="ml-auto flex min-h-11 items-center gap-2 rounded-t-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <MaterialIcon name="edit" />
        Edit event
      </Link>
    </nav>
  );
}
