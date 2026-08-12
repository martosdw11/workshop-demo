/**
 * Formatter tampilan — dipakai bersama Server Component dan Client Component.
 *
 * Semua waktu disimpan UTC (`timestamptz`, A-07) dan dirender di timezone
 * browser. Locale dikunci `id-ID` supaya nama bulan dan pemisah ribuan konsisten
 * dengan label domain Bahasa Indonesia pada PRD.
 *
 * CATATAN HIDRASI: fungsi tanggal absolut memakai `Intl` dengan timezone
 * browser, sehingga server (UTC) dan client bisa menghasilkan string berbeda.
 * Karena itu komponen yang menampilkannya dirender di client, atau memakai
 * `suppressHydrationWarning` seperti pada `RelativeTime`.
 */

const LOCALE = 'id-ID';

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `12 Agu 2026` — dipakai kartu event, achievement, tabel. */
export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toDate(value));
}

/** `12 Agu 2026, 09.30` — dipakai detail event & jadwal. */
export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
}

/**
 * Rentang jadwal event. Bila keduanya di bulan & tahun yang sama, bagian yang
 * berulang dibuang: `12 – 14 Agu 2026`, bukan `12 Agu 2026 – 14 Agu 2026`.
 */
export function formatDateRange(
  start: string | number | Date,
  end: string | number | Date,
): string {
  const startDate = toDate(start);
  const endDate = toDate(end);

  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric' }).format(startDate);
    return `${day} – ${formatDate(endDate)}`;
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/**
 * Waktu relatif untuk timeline respons & activity feed: `5 menit yang lalu`.
 * Di bawah satu menit dianggap "Baru saja" — respons yang baru saja dikirim
 * (termasuk hasil optimistic update) tidak boleh muncul sebagai "0 detik lalu".
 */
export function formatRelativeTime(value: string | number | Date, now: Date = new Date()): string {
  const target = toDate(value);
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);

  if (abs < 60 * 1000) return 'Baru saja';

  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return 'Baru saja';
}

/** `4.250` — angka poin dengan pemisah ribuan. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** `+150` — delta poin pada Achievement History & badge materi. */
export function formatPointsDelta(value: number): string {
  return `+${formatNumber(value)}`;
}

/** Persentase progres dibulatkan & dijepit ke 0–100. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** `Modul 3 • Lesson 2` — overline MaterialHeader (§6.6). */
export function formatMaterialOverline(moduleIndex: number, lessonIndex?: number | null): string {
  return lessonIndex ? `Modul ${moduleIndex} • Lesson ${lessonIndex}` : `Modul ${moduleIndex}`;
}
