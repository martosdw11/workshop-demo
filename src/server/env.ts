import { z } from 'zod';

/**
 * Validasi environment variable — TDD §10.
 *
 * Aplikasi GAGAL CEPAT saat startup bila variable wajib kosong, termasuk aturan
 * bersyarat `STORAGE_DRIVER`. Lebih baik gagal saat deploy daripada baru ketahuan
 * saat admin meng-upload cover pertama.
 *
 * File ini hidup di `src/server/**` sehingga TIDAK boleh di-import dari
 * `features/**` atau `components/**` — ditegakkan ESLint `no-restricted-imports`
 * (TDD §1.3). Ia sengaja TIDAK memakai paket `server-only` karena modul yang sama
 * dipakai oleh CLI seed/migrate yang berjalan di Node murni, di luar bundler Next.
 */

const intFromEnv = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  DATABASE_POOL_MAX: intFromEnv(10),

  // Session (TDD §5.1)
  SESSION_COOKIE_NAME: z.string().min(1).default('lsai_session'),
  SESSION_TTL_SECONDS: intFromEnv(28_800), // 8 jam
  SESSION_REMEMBER_TTL_SECONDS: intFromEnv(2_592_000), // 30 hari
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET minimal 32 karakter'),
  ARGON2_MEMORY_KIB: intFromEnv(19_456), // OWASP minimum 19 MiB

  // Media storage (TDD §8.1)
  STORAGE_DRIVER: z.enum(['blob', 'local']),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  LOCAL_STORAGE_DIR: z.string().optional(),
  MEDIA_PUBLIC_HOST: z.string().url(),
  UPLOAD_MAX_COVER_BYTES: intFromEnv(3_145_728), // 3 MB
  UPLOAD_MAX_IMAGE_BYTES: intFromEnv(2_097_152), // 2 MB

  // Perilaku aplikasi
  RATE_LIMIT_RESPONSE_PER_MINUTE: intFromEnv(10),
  /** Batas registrasi/jam per IP. Default 300 untuk mengakomodasi pendaftaran
   *  massal saat workshop (banyak peserta di satu jaringan/NAT). Turunkan bila
   *  ingin proteksi anti-spam lebih ketat (TDD §9.3 semula 3). */
  RATE_LIMIT_REGISTER_PER_HOUR: intFromEnv(300),
  DASHBOARD_CACHE_TTL_SECONDS: intFromEnv(30),
  STALLED_THRESHOLD_DAYS: intFromEnv(3),

  // Bootstrap admin pertama (dipakai seed)
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().min(2).max(120).default('Admin Learning Study'),
  SEED_ADMIN_PHONE: z.string().min(9).max(20).default('+628123456789'),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
});

/** Aturan bersyarat: driver storage menentukan variable mana yang wajib. */
const envSchema = baseSchema.superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER === 'blob' && !env.BLOB_READ_WRITE_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BLOB_READ_WRITE_TOKEN'],
      message: 'Wajib diisi ketika STORAGE_DRIVER=blob',
    });
  }
  if (env.STORAGE_DRIVER === 'local' && !env.LOCAL_STORAGE_DIR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['LOCAL_STORAGE_DIR'],
      message: 'Wajib diisi ketika STORAGE_DRIVER=local',
    });
  }
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Konfigurasi environment tidak valid. Periksa .env terhadap .env.example:\n${details}`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
