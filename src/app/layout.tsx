import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

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
    <html lang="id" className={`${inter.variable} ${materialSymbols.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
