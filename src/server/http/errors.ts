/**
 * Katalog kode error — TDD §9.4.
 *
 * `code` adalah KONTRAK MESIN (UPPER_SNAKE, tidak pernah berubah setelah rilis);
 * `message` adalah teks Bahasa Indonesia siap tampil; `details` hanya untuk data
 * tambahan yang aman ditampilkan — TIDAK BOLEH memuat stack trace, SQL, atau data
 * pengguna lain (TDD §9.1).
 *
 * ASUMSI EKSPLISIT (A-B01): tabel §9.4 tidak memuat 6 kode yang dipakai kontrak
 * API §3.3/§3.4, yaitu `EVENT_NOT_PUBLISHED`, `EVENT_PUBLISHED_IMMUTABLE_FIELD`,
 * `MATERIAL_LOCKED_BY_PROGRESS`, `POINTS_NEGATIVE`, `NOT_AN_ISSUE`, dan
 * `SERVICE_UNAVAILABLE` (health check). Karena §3 adalah kontrak yang tidak boleh
 * diubah, keenamnya DITAMBAHKAN di sini dengan status HTTP persis seperti tertulis
 * di §3 dan pesan Bahasa Indonesia yang senada dengan gaya §9.4. Kode §9.4 sendiri
 * tidak ada yang diubah, dihapus, atau dinaikkan/diturunkan statusnya.
 */

export type ErrorCode = keyof typeof ERROR_CATALOG;

type CatalogEntry = { readonly status: number; readonly message: string };

export const ERROR_CATALOG = {
  // --- 400 ---
  BAD_REQUEST: { status: 400, message: 'Permintaan tidak valid.' },

  // --- 401 ---
  UNAUTHENTICATED: { status: 401, message: 'Sesi Anda telah berakhir. Silakan masuk kembali.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Email atau password salah.' },

  // --- 403 ---
  FORBIDDEN: { status: 403, message: 'Anda tidak memiliki akses ke halaman ini.' },
  ACCOUNT_INACTIVE: { status: 403, message: 'Akun Anda dinonaktifkan. Hubungi admin.' },
  ENROLLMENT_COMPLETED: {
    status: 403,
    message: 'Event ini sudah Anda selesaikan. Respons tidak dapat ditambahkan lagi.',
  },
  MATERIAL_LOCKED: { status: 403, message: 'Selesaikan materi sebelumnya terlebih dahulu.' },
  NOT_AT_LAST_MATERIAL: {
    status: 403,
    message: 'Selesaikan semua materi terlebih dahulu sebelum menekan Finish.',
  },
  CANNOT_DEMOTE_SELF: {
    status: 403,
    message: 'Anda tidak dapat mengubah peran atau status akun sendiri.',
  },
  CANNOT_DEACTIVATE_SELF: {
    status: 403,
    message: 'Anda tidak dapat mengubah peran atau status akun sendiri.',
  },
  // A-B01 — dipakai §3.3 `POST /events/:eventId/enroll`
  EVENT_NOT_PUBLISHED: {
    status: 403,
    message: 'Event ini belum dipublikasikan sehingga belum dapat diikuti.',
  },
  // A-B01 — dipakai §3.4 `PATCH /admin/events/:id`
  EVENT_PUBLISHED_IMMUTABLE_FIELD: {
    status: 403,
    message: 'Field ini tidak dapat diubah setelah event dipublikasikan.',
  },
  // A-B01 — dipakai §3.4 `PATCH /admin/materials/:id`
  MATERIAL_LOCKED_BY_PROGRESS: {
    status: 403,
    message: 'Materi ini sudah dikerjakan peserta sehingga tidak dapat diubah.',
  },

  // --- 404 ---
  EVENT_NOT_FOUND: { status: 404, message: 'Data yang Anda cari tidak ditemukan.' },
  USER_NOT_FOUND: { status: 404, message: 'Data yang Anda cari tidak ditemukan.' },
  MATERIAL_NOT_FOUND: { status: 404, message: 'Data yang Anda cari tidak ditemukan.' },
  NOT_FOUND: { status: 404, message: 'Data yang Anda cari tidak ditemukan.' },

  // --- 409 ---
  EMAIL_TAKEN: { status: 409, message: 'Email ini sudah terdaftar.' },
  ALREADY_ENROLLED: { status: 409, message: 'Anda sudah mengikuti event ini.' },
  QUOTA_FULL: { status: 409, message: 'Kuota peserta event ini sudah penuh.' },
  MATERIAL_HAS_PROGRESS: {
    status: 409,
    message: 'Materi tidak dapat dihapus karena sudah dikerjakan peserta.',
  },
  EVENT_HAS_ENROLLMENTS: {
    status: 409,
    message: 'Event tidak dapat dihapus karena sudah memiliki peserta.',
  },
  CANNOT_UNPUBLISH_WITH_ENROLLMENTS: {
    status: 409,
    message: 'Event yang sudah diikuti peserta tidak dapat dikembalikan ke Draft.',
  },
  LAST_ADMIN: { status: 409, message: 'Minimal harus ada satu admin aktif.' },
  STALE_TREE: { status: 409, message: 'Struktur materi berubah di sesi lain. Muat ulang halaman.' },

  // --- 413 ---
  FILE_TOO_LARGE: { status: 413, message: 'Ukuran file melebihi batas maksimum.' },

  // --- 422 ---
  VALIDATION_ERROR: { status: 422, message: 'Periksa kembali isian Anda.' },
  MAX_DEPTH_EXCEEDED: { status: 422, message: 'Sub-materi tidak dapat memiliki sub-materi lagi.' },
  EVENT_HAS_NO_MATERIAL: {
    status: 422,
    message: 'Tambahkan minimal satu materi sebelum publikasi.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 422,
    message: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.',
  },
  // A-B01 — dipakai §3.4 `POST /admin/events/:id/materials`
  POINTS_NEGATIVE: { status: 422, message: 'Poin materi tidak boleh bernilai negatif.' },
  // A-B01 — dipakai §3.4 `PATCH /admin/responses/:id/issue-status`
  NOT_AN_ISSUE: {
    status: 422,
    message: 'Status hanya dapat diubah pada respons bertipe Issue / Kendala.',
  },

  // --- 429 ---
  RATE_LIMITED: { status: 429, message: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },

  // --- 500 / 503 ---
  INTERNAL_ERROR: { status: 500, message: 'Terjadi kesalahan pada sistem. Coba beberapa saat lagi.' },
  // A-B01 — dipakai `GET /api/v1/health` (TDD §11.1)
  SERVICE_UNAVAILABLE: { status: 503, message: 'Layanan sedang tidak tersedia.' },
} as const satisfies Record<string, CatalogEntry>;

/** Detail tambahan yang aman dikirim ke klien (§9.1). */
export type ErrorDetails = Record<string, unknown>;

/**
 * Exception domain. Satu-satunya cara service layer melaporkan kegagalan yang
 * punya arti bisnis — `withHandler()` memetakannya ke status + amplop §9.1.
 * Exception lain apa pun dipetakan ke `500 INTERNAL_ERROR` generik.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, details?: ErrorDetails, messageOverride?: string) {
    const entry = ERROR_CATALOG[code];
    super(messageOverride ?? entry.message);
    this.name = 'AppError';
    this.code = code;
    this.status = entry.status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Helper ringkas agar service layer tidak perlu `throw new` di banyak tempat. */
export function fail(code: ErrorCode, details?: ErrorDetails, messageOverride?: string): never {
  throw new AppError(code, details, messageOverride);
}
