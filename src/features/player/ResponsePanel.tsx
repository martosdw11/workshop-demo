'use client';

import * as React from 'react';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { ResponseComposer } from './ResponseComposer';
import { ResponseTimeline } from './ResponseTimeline';
import { ResponseTypeTabs } from './ResponseTypeTabs';
import type { ResponseType } from './types';

/**
 * ResponsePanel — TDD §6.6, panel "Discussion & Responses" (PRD §3.A.4).
 *
 * **Aturan read-only (§6.6):** saat `readOnly`, `ResponseComposer` TIDAK
 * DIRENDER sama sekali — bukan sekadar `disabled`. Komponen yang di-disable
 * masih ada di DOM dan masih bisa dihidupkan lewat devtools; yang tidak dirender
 * tidak bisa. `ResponseTimeline` tetap tampil pada kedua mode.
 */
export function ResponsePanel({
  materialId,
  enrollmentId,
  readOnly,
  author,
  completedAt,
  totalPoints,
  resultHref,
}: {
  materialId: number;
  enrollmentId: number;
  readOnly: boolean;
  author: { id: number; name: string; initials: string };
  completedAt: string | null;
  totalPoints: number;
  resultHref?: string;
}) {
  const [type, setType] = React.useState<ResponseType>('answer');

  return (
    <section
      aria-labelledby="response-panel-title"
      className="mt-8 rounded-lg border border-outline-variant bg-surface p-4 md:p-6"
    >
      <h2 id="response-panel-title" className="mb-4 text-title-lg text-on-surface">
        Discussion &amp; Responses
      </h2>

      <Tabs value={type} onValueChange={(value) => setType(value as ResponseType)}>
        <ResponseTypeTabs />

        {(['answer', 'comment', 'issue'] as const).map((tabType) => (
          <TabsContent key={tabType} value={tabType}>
            {readOnly ? (
              <ReadOnlyBanner
                completedAt={completedAt}
                totalPoints={totalPoints}
                resultHref={resultHref}
              />
            ) : (
              <ResponseComposer
                materialId={materialId}
                enrollmentId={enrollmentId}
                type={tabType}
                author={author}
              />
            )}

            <ResponseTimeline materialId={materialId} type={tabType} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
