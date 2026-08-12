'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Toaster global — kanal penyajian untuk error `429`/`500` (§9.4 baris terakhir)
 * dan konfirmasi aksi admin.
 *
 * Warna diambil dari token design system lewat `toastOptions.classNames`
 * (bukan tema bawaan sonner), supaya toast ikut bergeser saat dark mode.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-level2 gap-3 p-4',
          title: 'text-label-md text-on-surface',
          description: 'text-body-sm text-on-surface-variant',
          actionButton: 'rounded-lg bg-primary text-on-primary px-3 py-1 text-label-sm',
          cancelButton: 'rounded-lg bg-surface-container-high text-on-surface px-3 py-1 text-label-sm',
          error: 'border-error-container',
          success: 'border-secondary-fixed-dim',
        },
      }}
    />
  );
}

export { toast };
