/**
 * Pemilih tema terang/gelap (PRD §7.7).
 *
 * Palet dark mode sudah lengkap di `styles/globals.css` dengan pemicu tunggal:
 * kelas `.dark` pada <html>. Modul ini hanya mengurus pemicunya:
 *
 *   · belum pernah memilih → tema terang (default aplikasi, bukan preferensi
 *     sistem);
 *   · sudah memilih        → kelas eksplisit `.light`/`.dark` dari localStorage.
 */

export const THEME_STORAGE_KEY = 'lsai-theme';

export type Theme = 'light' | 'dark';

/**
 * Skrip anti-FOUC. Dirender BLOKIR di dalam <head> (`src/app/layout.tsx`) supaya
 * kelas tema sudah menempel sebelum cat pertama — kalau ditunda sampai React
 * hidrasi, pengguna dark mode akan melihat kedipan putih di setiap navigasi
 * hard-load. CSP mengizinkan ini lewat `script-src 'unsafe-inline'`
 * (next.config.ts, catatan A-B07).
 *
 * Sengaja tanpa `document.documentElement.dataset`: kelas saja sudah cukup, dan
 * satu titik kebenaran lebih sulit dibuat tidak sinkron.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var t=(s==='light'||s==='dark')?s:'light';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);}catch(e){}})();`;

/** Menerapkan tema ke <html>. Dipanggil hanya di browser. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

/** Tema yang SEDANG tampil, dibaca dari DOM — bukan dari state React. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Preferensi tersimpan; `null` berarti "belum memilih" (default terang). */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage bisa ditolak (mode privat / cookie diblokir). Tema tetap berjalan,
    // hanya tidak diingat antar kunjungan — itu degradasi yang dapat diterima.
    return null;
  }
}
