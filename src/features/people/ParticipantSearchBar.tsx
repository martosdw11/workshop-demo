'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * ParticipantSearchBar — TDD §6.9: **debounce 300 ms → URL params**.
 *
 * Debounce-nya bukan kosmetik: tanpa itu setiap huruf memicu satu navigasi
 * Next.js dan satu query ke daftar peserta.
 */
export function ParticipantSearchBar({
  q,
  status,
  onParamsChange,
  statusOptions = [
    { value: 'all', label: 'Semua status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  placeholder = 'Cari nama atau email…',
  extra,
}: {
  q: string;
  status: string;
  /** Dipanggil sebelum navigasi — dipakai me-reset pagination cursor. */
  onParamsChange?: () => void;
  statusOptions?: Array<{ value: string; label: string }>;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = React.useState(q);

  React.useEffect(() => setDraft(q), [q]);

  const pushParams = React.useCallback(
    (next: { q?: string; status?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.q !== undefined) {
        if (next.q.trim() === '') params.delete('q');
        else params.set('q', next.q.trim());
      }
      if (next.status !== undefined) {
        if (next.status === 'all') params.delete('status');
        else params.set('status', next.status);
      }
      onParamsChange?.();
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, onParamsChange],
  );

  React.useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => pushParams({ q: draft }), 300);
    return () => clearTimeout(timer);
  }, [draft, q, pushParams]);

  return (
    <div className="flex flex-col gap-3 border-b border-outline-variant p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-72">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <MaterialIcon name="search" className="text-[20px] text-outline" />
        </span>
        <Input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label="Cari peserta"
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {extra}
        <Select value={status} onValueChange={(value) => pushParams({ status: value })}>
          <SelectTrigger className="w-44" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
