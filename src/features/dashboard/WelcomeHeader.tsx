/**
 * WelcomeHeader — TDD §6.4, acuan `participant_dashboard/`.
 * Judul halaman turun ke `headline-lg-mobile` di layar sempit (DESIGN.md
 * "Typography → Scale"), bukan mengecil sembarangan.
 */
export function WelcomeHeader({ name }: { name: string }) {
  return (
    <div className="mb-8">
      <h1 className="mb-2 text-headline-lg-mobile text-on-surface md:text-headline-lg">
        Welcome back, {name}
      </h1>
      <p className="text-body-md text-on-surface-variant">
        Berikut ringkasan progres pembelajaran Anda.
      </p>
    </div>
  );
}
