import { z } from 'zod';

import { MAX_PAGE_SIZE } from '../constants';

/**
 * Blok validasi yang dipakai ulang seluruh domain — TDD §9.2.
 * Skema di folder ini SENGAJA bebas dari import `server/**` agar form FE
 * (react-hook-form + zodResolver) memakai aturan yang sama persis (§3.1).
 */

/** ID numerik dari route param (selalu datang sebagai string). */
export const idParam = z.coerce
  .number({ invalid_type_error: 'ID tidak valid.' })
  .int('ID tidak valid.')
  .positive('ID tidak valid.');

/** ID di dalam body JSON (sudah bertipe number). */
export const idNumber = z.number().int().positive();

export const cursorParam = z.string().min(1).max(512).optional();

export function limitParam(fallback: number) {
  return z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(fallback);
}

/** Kata kunci pencarian — dinormalisasi jadi `undefined` saat kosong. */
export const searchParam = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/** Datetime ISO-8601 dari klien (§3.4 `startAt`/`endAt`). */
export const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Format tanggal tidak valid.' })
  .or(z.string().datetime({ message: 'Format tanggal tidak valid.' }));

export const paginationQuery = (defaultLimit: number) =>
  z.object({ cursor: cursorParam, limit: limitParam(defaultLimit) });
