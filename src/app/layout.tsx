import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
    <html lang="id" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
