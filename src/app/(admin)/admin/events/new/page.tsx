import type { Metadata } from 'next';

import { BuilderStepper } from '@/features/builder/BuilderStepper';
import { EventInfoForm } from '@/features/builder/EventInfoForm';

/**
 * Event Builder (create) — hanya Step 1.
 *
 * Step 2 belum bisa dibuka karena kurikulum membutuhkan `eventId` untuk
 * `POST /admin/events/:id/materials`. Setelah event tersimpan sebagai draft,
 * form mengarahkan ke `/admin/events/:id/edit?step=2`.
 */
export const metadata: Metadata = { title: 'Buat Event — Learning Study AI' };

export default function NewEventPage() {
  return (
    <div className="px-container-mobile py-6 md:px-container-desktop">
      <h1 className="mb-6 text-headline-lg-mobile text-on-surface md:text-headline-lg">
        Buat Event Baru
      </h1>

      <BuilderStepper step={1} canGoToStep2={false} />
      <EventInfoForm event={null} />
    </div>
  );
}
