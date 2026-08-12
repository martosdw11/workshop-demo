import { hash, verify } from '@node-rs/argon2';

import { env } from '../env';

/**
 * `Algorithm.Argon2id` dari @node-rs/argon2 adalah `const enum`, yang tidak bisa
 * diakses saat `isolatedModules` aktif (dipakai Next.js). Nilainya dituliskan
 * langsung — 0=Argon2d, 1=Argon2i, 2=Argon2id.
 */
const ARGON2ID = 2;

/**
 * Hashing password — TDD §5.1 / PRD §7.8.
 *
 * Argon2id dengan parameter OWASP minimum: memoryCost 19 MiB, timeCost 2,
 * parallelism 1. Password TIDAK PERNAH disimpan plaintext di mana pun,
 * termasuk di seed script.
 *
 * Hashing ini memang mahal secara CPU — itulah sebabnya endpoint login masuk
 * rate limit ketat (TDD §9.3).
 */
const options = {
  algorithm: ARGON2ID,
  memoryCost: env.ARGON2_MEMORY_KIB,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, options);
}

/**
 * Selalu jalankan verifikasi sampai selesai walau user tidak ditemukan
 * (pemanggil bertanggung jawab melakukan dummy-verify) agar durasi respons
 * tidak membocorkan keberadaan akun.
 */
export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain, options);
}
