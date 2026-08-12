import { z } from 'zod';

import { LIMITS } from '../constants';
import { normalizePhone } from '../phone';

/**
 * Validasi auth — TDD §9.2.
 *
 * Dipakai DUA KALI: di `LoginForm`/`RegisterForm` (epic FE) dan di Route Handler.
 * Satu sumber aturan berarti pesan error di form dan dari server tidak bisa
 * berbeda.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email wajib diisi.')
  .email('Format email tidak valid.')
  .max(254, 'Email terlalu panjang.');

export const nameSchema = z
  .string()
  .trim()
  .min(LIMITS.nameMin, `Nama minimal ${LIMITS.nameMin} karakter.`)
  .max(LIMITS.nameMax, `Nama maksimal ${LIMITS.nameMax} karakter.`);

/** Normalisasi E.164 terjadi DI DALAM skema, sehingga service selalu menerima `+62…`. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Nomor HP wajib diisi.')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nomor HP tidak valid. Gunakan format 08… atau +62….',
      });
      return z.NEVER;
    }
    return normalized;
  });

/** Minimum 8 karakter, wajib memuat huruf DAN angka (§9.2). */
export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Password minimal ${LIMITS.passwordMin} karakter.`)
  .max(200, 'Password terlalu panjang.')
  .regex(/[A-Za-z]/, 'Password harus memuat minimal satu huruf.')
  .regex(/\d/, 'Password harus memuat minimal satu angka.');

/**
 * Field `role` SENGAJA tidak ada di skema: registrasi mandiri selalu menghasilkan
 * `role='participant'` dan nilai `role` dari body diabaikan total — guard
 * privilege escalation (TDD §5.3).
 */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Password login TIDAK memakai `passwordSchema`: aturan kekuatan password hanya
  // berlaku saat membuat password. Menolak login "karena formatnya lemah" akan
  // membocorkan aturan dan mengunci akun lama.
  password: z.string().min(1, 'Password wajib diisi.').max(200),
  rememberMe: z.coerce.boolean().optional().default(false),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
