import { z, type ZodTypeAny, type output } from 'zod';

import { AppError } from './errors';

/**
 * Cursor pagination — TDD §3.1.
 *
 * Sengaja BUKAN `OFFSET`: pada tabel `responses` yang tumbuh terus, `OFFSET`
 * besar memaksa scan seluruh baris yang dilewati. Cursor di sini adalah keyset —
 * nilai kolom sort terakhir + `id` sebagai pemecah seri, di-encode base64url.
 *
 * Isi cursor sengaja tidak dienkripsi: ia hanya memuat nilai sort yang sudah
 * terlihat klien pada halaman sebelumnya (id, timestamp), bukan data rahasia.
 * Yang wajib dijaga adalah cursor rusak TIDAK boleh menjadi 500 — ia dipetakan
 * ke `400 BAD_REQUEST`.
 */

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<S extends ZodTypeAny>(
  cursor: string | null | undefined,
  schema: S,
): output<S> | null {
  if (!cursor) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new Error('bentuk cursor tidak dikenal');
    return parsed.data;
  } catch {
    throw new AppError('BAD_REQUEST', { fields: { cursor: 'Cursor tidak valid.' } });
  }
}

/** Cursor berbasis `id` menurun/naik saja (mis. daftar event admin). */
export const idCursorSchema = z.object({ id: z.number().int().positive() });

/** Cursor keyset `(waktu, id)` — dipakai timeline & daftar yang di-sort waktu. */
export const timeCursorSchema = z.object({
  at: z.string().datetime(),
  id: z.number().int().positive(),
});

export type IdCursor = z.infer<typeof idCursorSchema>;
export type TimeCursor = z.infer<typeof timeCursorSchema>;

/**
 * Pola baca standar: query `limit + 1` baris, baris ekstra hanya menjadi penanda
 * bahwa masih ada halaman berikutnya (tidak ikut dikirim).
 */
export function sliceWithCursor<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Record<string, unknown>,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(toCursor(last)) };
}
