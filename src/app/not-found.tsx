import Link from 'next/link';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { buttonVariants } from '@/components/ui/button';
import { messageForCode } from '@/lib/error-messages';
import { cn } from '@/lib/utils';

/** Halaman 404 — teksnya memakai kode `NOT_FOUND` dari katalog §9.4. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-container-mobile">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <MaterialIcon name="search_off" className="text-[32px]" />
        </span>
        <h1 className="text-headline-md text-on-surface">Halaman tidak ditemukan</h1>
        <p className="text-body-md text-on-surface-variant">{messageForCode('NOT_FOUND')}</p>
        <Link href="/" className={cn(buttonVariants({ variant: 'primary' }))}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
