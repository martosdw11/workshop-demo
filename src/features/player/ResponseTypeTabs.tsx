'use client';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RESPONSE_TAB_LABELS, type ResponseType } from './types';

/**
 * ResponseTypeTabs — TDD §6.6, PRD §3.A.4.
 *
 * Tiga tab dengan label PERSIS dari PRD: **Jawaban / Komentar / Issue / Kendala**.
 * Warna mengikuti semantik wajib §6.1:
 *   Jawaban = `primary` · Komentar = neutral/`on-surface-variant` ·
 *   Issue    = `error`.
 */
const TAB_CONFIG: Array<{ value: ResponseType; icon: string; activeClass: string }> = [
  { value: 'answer', icon: 'forum', activeClass: 'data-[state=active]:text-primary' },
  { value: 'comment', icon: 'comment', activeClass: 'data-[state=active]:text-on-surface-variant' },
  {
    value: 'issue',
    icon: 'report_problem',
    activeClass:
      'data-[state=active]:text-error data-[state=active]:bg-error-container hover:text-error',
  },
];

export function ResponseTypeTabs() {
  return (
    <TabsList className="w-full justify-start overflow-x-auto">
      {TAB_CONFIG.map((tab) => (
        <TabsTrigger key={tab.value} value={tab.value} className={cn(tab.activeClass)}>
          <MaterialIcon name={tab.icon} className="text-[18px]" />
          {RESPONSE_TAB_LABELS[tab.value]}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
