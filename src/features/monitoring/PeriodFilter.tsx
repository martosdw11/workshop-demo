'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardPeriod } from '@/lib/constants';

/**
 * PeriodFilter & EventFilter — TDD §6.8, disinkronkan ke URL search params.
 *
 * Keduanya memakai URL agar tampilan dashboard bisa dibagikan apa adanya
 * ("lihat pipeline event X pada kuartal ini") dan agar polling tidak kehilangan
 * konteks filter saat halaman di-refresh.
 */
const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  quarter: 'This Quarter',
  ytd: 'Year to Date',
};

function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '' || value === 'all') params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

export function PeriodFilter({ value }: { value: DashboardPeriod }) {
  const setParam = useParamSetter();

  return (
    <div className="relative">
      <Select value={value} onValueChange={(next) => setParam('period', next)}>
        <SelectTrigger className="w-48 pl-10" aria-label="Filter periode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((period) => (
            <SelectItem key={period} value={period}>
              {PERIOD_LABELS[period]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        <MaterialIcon name="calendar_today" className="text-[18px] text-on-surface-variant" />
      </span>
    </div>
  );
}

export function EventFilter({
  value,
  options,
}: {
  value: number | null;
  options: Array<{ id: number; title: string }>;
}) {
  const setParam = useParamSetter();

  return (
    <div className="relative">
      <Select
        value={value === null ? 'all' : String(value)}
        onValueChange={(next) => setParam('eventId', next === 'all' ? null : next)}
      >
        <SelectTrigger className="w-56 pl-10" aria-label="Filter event">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        <MaterialIcon name="filter_list" className="text-[18px] text-on-surface-variant" />
      </span>
    </div>
  );
}
