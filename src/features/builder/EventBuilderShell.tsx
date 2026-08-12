'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { BuilderStepper } from './BuilderStepper';
import { CurriculumBuilder } from './CurriculumBuilder';
import { EventInfoForm } from './EventInfoForm';
import { PublishBar } from './PublishBar';
import type { AdminEvent, MaterialNode } from './types';

/**
 * Kerangka Event Builder yang menyatukan Stepper + Step 1 + Step 2 + PublishBar.
 *
 * Langkah aktif disimpan di URL (`?step=`) supaya tombol back browser bekerja
 * dan tautan "lanjutkan menyusun kurikulum" bisa dibagikan.
 */
export function EventBuilderShell({
  event,
  initialTree,
  lockedMaterialIds,
}: {
  event: AdminEvent;
  initialTree: MaterialNode[];
  lockedMaterialIds: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = searchParams.get('step') === '2' ? 2 : 1;

  const setStep = (next: 1 | 2) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(next));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex-1 px-container-mobile py-6 md:px-container-desktop">
        <BuilderStepper step={step} onStepChange={setStep} canGoToStep2 />

        {step === 1 ? (
          <EventInfoForm event={event} onSaved={() => setStep(2)} />
        ) : (
          <CurriculumBuilder
            eventId={event.id}
            initialTree={initialTree}
            lockedMaterialIds={lockedMaterialIds}
          />
        )}
      </div>

      <PublishBar event={event} />
    </div>
  );
}

/** Wrapper `React.Suspense` disediakan halaman — `useSearchParams` menuntutnya. */
export default EventBuilderShell;
