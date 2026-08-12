import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dibutuhkan target deployment Opsi B (satu container Docker) — TDD §11.1.
  // Tidak berpengaruh saat deploy ke Vercel.
  output: 'standalone',

  // Paket native tidak boleh di-bundle: harus di-load sebagai modul Node biasa.
  serverExternalPackages: ['@node-rs/argon2', 'postgres'],

  eslint: {
    // Lint dijalankan sebagai langkah CI tersendiri (`npm run lint`), bukan menyamar
    // sebagai kegagalan build — supaya penyebab build gagal selalu jelas.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
