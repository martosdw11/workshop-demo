/**
 * Barrel skema Zod domain — TDD §3.1 & §9.2.
 * Satu-satunya sumber aturan validasi: dipakai Route Handler (server) DAN form
 * react-hook-form (client), sehingga pesan error tidak bisa berbeda antar lapis.
 */
export * from './common';
export * from './auth';
export * from './event';
export * from './material';
export * from './response';
export * from './user';
