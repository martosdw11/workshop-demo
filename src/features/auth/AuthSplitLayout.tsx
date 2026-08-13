import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

/**
 * AuthSplitLayout — TDD §6.3, acuan `login_learning_study_ai/`.
 *
 * Panel brand indigo di kiri (desktop), form di kanan, brand header di mobile.
 *
 * PENYIMPANGAN SADAR DARI MOCKUP: ilustrasi di panel kiri pada mockup adalah
 * gambar dari `lh3.googleusercontent.com`. CSP produksi (`img-src 'self'` +
 * host media sendiri, next.config.ts) memblokir host itu, dan MVP tidak punya
 * aset pengganti. Panel diisi komposisi gradien dari token design system —
 * tidak ada satu pun nilai warna literal.
 */
export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <aside className="relative hidden flex-1 overflow-hidden bg-primary lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary-container/60 via-primary to-on-primary-fixed"
        />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-on-primary xl:p-24">
          <div className="flex items-center gap-3">
            <MaterialIcon name="school" filled className="text-[40px]" />
            <span className="text-display">Learning Study AI</span>
          </div>

          <div
            aria-hidden
            className="my-12 flex flex-1 items-center justify-center"
          >
            <div className="aspect-square w-full max-w-md rounded-xl border border-primary-fixed-dim/30 bg-gradient-to-tr from-primary-fixed/10 via-transparent to-secondary-fixed-dim/20" />
          </div>

          <div className="max-w-md">
            <h2 className="mb-4 text-headline-lg text-on-primary">Elevate your learning journey.</h2>
            <p className="text-body-lg text-primary-fixed-dim">
              Susun kurikulum, ikuti materi secara berurutan, dan kumpulkan poin dari setiap jawaban
              yang Anda kirim.
            </p>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col justify-center bg-surface px-container-mobile py-12 sm:px-6 lg:px-20 xl:px-32">
        {/* Pemilih tema ikut hadir sebelum login: preferensi tersimpan di
            localStorage, jadi ia tidak butuh sesi untuk bekerja. */}
        <ThemeToggle className="absolute right-4 top-4" />

        <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
          <MaterialIcon name="school" filled className="text-[28px] text-primary" />
          <span className="text-title-lg text-primary">Learning Study AI</span>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
