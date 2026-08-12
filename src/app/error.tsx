'use client';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { messageForCode } from '@/lib/error-messages';

/**
 * Error boundary global. Aturan epic ini: **tidak ada layar putih tanpa
 * penjelasan** — kegagalan render pun harus menghasilkan halaman yang
 * menjelaskan keadaan dan menawarkan jalan keluar.
 *
 * Pesan yang ditampilkan adalah teks generik `INTERNAL_ERROR` dari peta §9.4,
 * BUKAN `error.message`: pesan asli bisa memuat detail internal, dan kebijakan
 * §9.1 sudah menetapkan klien hanya menerima pesan generik.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-container-mobile">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <MaterialIcon name="error" className="text-[32px]" />
        </span>
        <h1 className="text-headline-md text-on-surface">Terjadi kesalahan</h1>
        <p className="text-body-md text-on-surface-variant">{messageForCode('INTERNAL_ERROR')}</p>
        <Button onClick={reset}>
          <MaterialIcon name="refresh" />
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
