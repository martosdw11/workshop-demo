import { isApiError, NETWORK_ERROR_CODE } from './api-client';

/**
 * Peta kode error → pesan Bahasa Indonesia — TDD §9.4.
 *
 * SATU kode = SATU teks yang sama di seluruh aplikasi. UI tidak pernah
 * mencocokkan string pesan; ia mencocokkan `error.code`, lalu meminta teksnya
 * ke sini. Teks di bawah disalin PERSIS dari katalog §9.4 agar pesan yang
 * datang dari server dan yang dirender klien tidak bisa berbeda.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // 400
  BAD_REQUEST: 'Permintaan tidak valid.',

  // 401
  UNAUTHENTICATED: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  INVALID_CREDENTIALS: 'Email atau password salah.',

  // 403
  FORBIDDEN: 'Anda tidak memiliki akses ke halaman ini.',
  ACCOUNT_INACTIVE: 'Akun Anda dinonaktifkan. Hubungi admin.',
  ENROLLMENT_COMPLETED: 'Event ini sudah Anda selesaikan. Respons tidak dapat ditambahkan lagi.',
  MATERIAL_LOCKED: 'Selesaikan materi sebelumnya terlebih dahulu.',
  NOT_AT_LAST_MATERIAL: 'Selesaikan semua materi terlebih dahulu sebelum menekan Finish.',
  CANNOT_DEMOTE_SELF: 'Anda tidak dapat mengubah peran atau status akun sendiri.',
  CANNOT_DEACTIVATE_SELF: 'Anda tidak dapat mengubah peran atau status akun sendiri.',
  EVENT_NOT_PUBLISHED: 'Event ini belum dipublikasikan sehingga belum dapat diikuti.',
  EVENT_PUBLISHED_IMMUTABLE_FIELD: 'Field ini tidak dapat diubah setelah event dipublikasikan.',
  MATERIAL_LOCKED_BY_PROGRESS: 'Materi ini sudah dikerjakan peserta sehingga tidak dapat diubah.',

  // 404
  EVENT_NOT_FOUND: 'Data yang Anda cari tidak ditemukan.',
  USER_NOT_FOUND: 'Data yang Anda cari tidak ditemukan.',
  MATERIAL_NOT_FOUND: 'Data yang Anda cari tidak ditemukan.',
  NOT_FOUND: 'Data yang Anda cari tidak ditemukan.',

  // 409
  EMAIL_TAKEN: 'Email ini sudah terdaftar.',
  ALREADY_ENROLLED: 'Anda sudah mengikuti event ini.',
  QUOTA_FULL: 'Kuota peserta event ini sudah penuh.',
  MATERIAL_HAS_PROGRESS: 'Materi tidak dapat dihapus karena sudah dikerjakan peserta.',
  EVENT_HAS_ENROLLMENTS: 'Event tidak dapat dihapus karena sudah memiliki peserta.',
  CANNOT_UNPUBLISH_WITH_ENROLLMENTS:
    'Event yang sudah diikuti peserta tidak dapat dikembalikan ke Draft.',
  LAST_ADMIN: 'Minimal harus ada satu admin aktif.',
  STALE_TREE: 'Struktur materi berubah di sesi lain. Muat ulang halaman.',

  // 413
  FILE_TOO_LARGE: 'Ukuran file melebihi batas maksimum.',

  // 422
  VALIDATION_ERROR: 'Periksa kembali isian Anda.',
  MAX_DEPTH_EXCEEDED: 'Sub-materi tidak dapat memiliki sub-materi lagi.',
  EVENT_HAS_NO_MATERIAL: 'Tambahkan minimal satu materi sebelum publikasi.',
  UNSUPPORTED_MEDIA_TYPE: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.',
  POINTS_NEGATIVE: 'Poin materi tidak boleh bernilai negatif.',
  NOT_AN_ISSUE: 'Status hanya dapat diubah pada respons bertipe Issue / Kendala.',

  // 429 / 500 / 503
  RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada sistem. Coba beberapa saat lagi.',
  SERVICE_UNAVAILABLE: 'Layanan sedang tidak tersedia.',

  /**
   * Kegagalan yang tidak pernah sampai ke server (offline / DNS / CORS). Tidak
   * ada di §9.4 karena §9.4 mengkatalogkan respons server; kode sintetis ini
   * dibuat di `api-client.ts` agar UI tidak perlu membedakan dua jenis error.
   */
  [NETWORK_ERROR_CODE]: 'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
};

const DEFAULT_MESSAGE = ERROR_MESSAGES.INTERNAL_ERROR;

/** Pesan siap tampil untuk sebuah kode. */
export function messageForCode(code: string | undefined): string {
  if (!code) return DEFAULT_MESSAGE;
  return ERROR_MESSAGES[code] ?? DEFAULT_MESSAGE;
}

/**
 * Pesan siap tampil untuk error apa pun yang tertangkap UI.
 *
 * Sumber teks adalah peta lokal, BUKAN `error.message` dari server — supaya satu
 * kode selalu menghasilkan kalimat yang sama walau server sempat mengirim varian
 * pesan (mis. `RATE_LIMITED` yang menyebutkan detik pada §3.5).
 */
export function messageForError(error: unknown): string {
  if (isApiError(error)) return messageForCode(error.code);
  return DEFAULT_MESSAGE;
}

/**
 * Varian `RATE_LIMITED` yang menyebut sisa waktu bila server mengirimkannya
 * (`details.retryAfterSeconds`, §3.5) — tetap satu sumber teks, hanya diperjelas.
 */
export function rateLimitMessage(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return ERROR_MESSAGES.RATE_LIMITED;
  return `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(retryAfterSeconds)} detik.`;
}

/**
 * Klasifikasi cara penyajian — §9.4 baris terakhir:
 *   `422` → inline di field · `409` join → dialog informatif · `429`/`500` → toast.
 */
export type ErrorPresentation = 'inline' | 'dialog' | 'toast' | 'form';

export function presentationFor(error: unknown): ErrorPresentation {
  if (!isApiError(error)) return 'toast';
  if (error.status === 422) return error.fieldErrors ? 'inline' : 'form';
  if (error.code === 'ALREADY_ENROLLED') return 'dialog';
  if (error.status === 409) return 'form';
  if (error.status === 429 || error.status >= 500 || error.status === 0) return 'toast';
  return 'form';
}
