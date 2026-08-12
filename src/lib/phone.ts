/**
 * Normalisasi nomor HP ke E.164 — TDD §9.2 & asumsi A-12.
 *
 * Disimpan ternormalisasi (`+62…`) supaya Participant List tidak memuat duplikat
 * semu `08…` vs `+628…`. Modul ini murni fungsi (tanpa akses server) sehingga
 * boleh dipakai form FE maupun service layer.
 *
 * ASUMSI EKSPLISIT (A-B02): default country code untuk input lokal yang diawali
 * `0` adalah Indonesia (`+62`), karena PRD hanya menyasar peserta internal
 * Indonesia dan tidak menyediakan selector negara di form registrasi.
 */

const DEFAULT_COUNTRY_CODE = '62';

/** Batas E.164: 9–15 digit termasuk kode negara (§9.2). */
const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

/**
 * Mengembalikan nomor E.164 (`+628123456789`) atau `null` bila tidak bisa
 * dinormalisasi. Pemanggil yang butuh pesan ramah memakai `phoneSchema`.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Buang spasi, tanda hubung, titik, dan tanda kurung yang lazim diketik manusia.
  const cleaned = trimmed.replace(/[\s\-.()]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits: string;
  if (cleaned.startsWith('+')) {
    digits = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    // Prefiks panggilan internasional gaya lama: 0062… → 62…
    digits = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    digits = DEFAULT_COUNTRY_CODE + cleaned.slice(1);
  } else {
    digits = cleaned;
  }

  if (digits.startsWith('0')) return null;
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;

  return `+${digits}`;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
