'use client';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { cn } from '@/lib/utils';

/**
 * BuilderStepper — TDD §6.7: Step 1 Event Info → Step 2 Curriculum Builder.
 *
 * Step 2 tidak dapat dipilih sebelum event tersimpan: kurikulum butuh
 * `eventId` untuk `POST /admin/events/:id/materials`. Itulah alasan langkahnya
 * berurutan, bukan sekadar tab.
 */
export function BuilderStepper({
  step,
  onStepChange,
  canGoToStep2,
}: {
  step: 1 | 2;
  onStepChange?: (step: 1 | 2) => void;
  canGoToStep2: boolean;
}) {
  const steps = [
    { index: 1 as const, label: 'Event Info', icon: 'info' },
    { index: 2 as const, label: 'Curriculum Builder', icon: 'account_tree' },
  ];

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map((item, position) => {
        const isActive = step === item.index;
        const isDisabled = item.index === 2 && !canGoToStep2;
        return (
          <li key={item.index} className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDisabled || !onStepChange}
              aria-current={isActive ? 'step' : undefined}
              title={isDisabled ? 'Simpan info event terlebih dahulu.' : undefined}
              onClick={() => onStepChange?.(item.index)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-label-md transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isActive
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
                isDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
              )}
            >
              <MaterialIcon name={item.icon} filled={isActive} />
              <span className="text-label-sm uppercase">Step {item.index}</span>
              {item.label}
            </button>
            {position === 0 && (
              <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
