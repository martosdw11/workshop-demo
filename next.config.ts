import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Host media untuk whitelist `img-src` (TDD §8.4, §10). Dibaca langsung dari
 * `process.env` — `next.config.ts` dievaluasi sebelum validasi env Zod berjalan.
 */
const mediaPublicHost = process.env.MEDIA_PUBLIC_HOST ?? '';

/**
 * Content-Security-Policy — lapis TERAKHIR pertahanan XSS (TDD §8.4), di belakang
 * sanitasi server-side di `lib/sanitize-html.ts`.
 *
 * ASUMSI EKSPLISIT (A-B07): §8.4 menuliskan `script-src 'self'`. Next.js App
 * Router menyisipkan skrip bootstrap inline pada setiap halaman, sehingga
 * `'self'` murni akan memblokir aplikasinya sendiri. Dipakai `'unsafe-inline'`
 * (dan `'unsafe-eval'` HANYA di development, untuk HMR). Pengetatannya ke
 * nonce-based CSP membutuhkan plumbing nonce di `middleware.ts` + `layout.tsx`,
 * yang keduanya milik epic FE — dicatat sebagai utang teknis, bukan diselipkan
 * diam-diam di sini.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // `https:` menyertai mode insert-URL sementara (gambar dari host eksternal
  // mana pun) — sempitkan kembali ke whitelist host saat fitur upload aktif lagi.
  `img-src 'self' data: blob: https:${mediaPublicHost ? ` ${mediaPublicHost}` : ''}`,
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .concat(';');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

  // Dibutuhkan target deployment Opsi B (satu container Docker) — TDD §11.1.
  // Tidak berpengaruh saat deploy ke Vercel.
  output: 'standalone',

  // Paket native / khusus Node tidak boleh di-bundle: harus di-load sebagai modul
  // Node biasa. `pino` masuk daftar karena ia menyelesaikan lokasi file internalnya
  // saat runtime — bila di-bundle, resolusi itu meleset.
  serverExternalPackages: ['@node-rs/argon2', 'postgres', 'pino'],

  eslint: {
    // Lint dijalankan sebagai langkah CI tersendiri (`npm run lint`), bukan menyamar
    // sebagai kegagalan build — supaya penyebab build gagal selalu jelas.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
