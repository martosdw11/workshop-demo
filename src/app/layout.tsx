import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { Providers } from './providers';

import '@/styles/globals.css';

/**
 * Inter di-self-host lewat next/font (bukan CDN eksternal) sesuai TDD Story 1.1.
 * Variabel `--font-inter` dikonsumsi oleh `fontFamily.sans` di tailwind.config.ts.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * Material Symbols Outlined juga di-self-host (TDD §6.2 + CSP `font-src 'self'`
 * di next.config.ts). File `.woff2` disalin dari paket `material-symbols` ke
 * `src/assets/fonts/` supaya ia ikut ter-hash dan ter-cache oleh build Next.
 *
 * `display: 'block'` dipilih di sini — berbeda dari teks: ikon yang sempat
 * dirender sebagai ligatur mentah ("check_circle") jauh lebih mengganggu
 * daripada jeda singkat tanpa ikon.
 */
const materialSymbols = localFont({
  src: '../assets/fonts/material-symbols-outlined.woff2',
  variable: '--font-material-symbols',
  display: 'block',
  weight: '100 700',
});

export const metadata: Metadata = {
  title: 'Learning Study AI',
  description: 'Platform pembelajaran berbasis event untuk lingkungan korporat.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * `suppressHydrationWarning` dibatasi pada <html> saja: skrip di bawah
     * sengaja mengubah `class` elemen ini sebelum React hidrasi, jadi
     * ketidakcocokan di situ memang diharapkan — bukan bug yang disembunyikan.
     * Atributnya tidak menurun ke anak, sehingga isi halaman tetap diperiksa.
     */
    <html
      lang="id"
      className={`${inter.variable} ${materialSymbols.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Harus di <head> dan sinkron: menundanya ke akhir <body> berarti satu
            frame dengan tema salah (FOUC) bagi pengguna dark mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
