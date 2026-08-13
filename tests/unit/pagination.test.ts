import { describe, expect, it } from 'vitest';

import {
  decodeCursor,
  encodeCursor,
  idCursorSchema,
  sliceWithCursor,
  timeCursorSchema,
} from '@/server/http/pagination';

/**
 * Cursor pagination murni — TDD §3.1. Tanpa database.
 * Kontrak terpenting: cursor rusak menjadi `400 BAD_REQUEST`, bukan 500.
 */

describe('encodeCursor / decodeCursor', () => {
  it('roundtrip cursor id', () => {
    const cursor = encodeCursor({ id: 42 });
    expect(decodeCursor(cursor, idCursorSchema)).toEqual({ id: 42 });
  });

  it('roundtrip cursor (waktu, id)', () => {
    const at = new Date('2026-08-13T07:00:00.000Z').toISOString();
    const cursor = encodeCursor({ at, id: 7 });
    expect(decodeCursor(cursor, timeCursorSchema)).toEqual({ at, id: 7 });
  });

  it('cursor kosong → null (halaman pertama)', () => {
    expect(decodeCursor(null, idCursorSchema)).toBeNull();
    expect(decodeCursor(undefined, idCursorSchema)).toBeNull();
    expect(decodeCursor('', idCursorSchema)).toBeNull();
  });

  it('cursor rusak → 400 BAD_REQUEST, bukan 500', () => {
    for (const rusak of ['bukan-base64url!!!', encodeCursor({ id: 'x' }), encodeCursor({})]) {
      expect(() => decodeCursor(rusak, idCursorSchema)).toThrowError(
        expect.objectContaining({ code: 'BAD_REQUEST', status: 400 }),
      );
    }
  });

  it('id non-positif ditolak oleh schema', () => {
    expect(() => decodeCursor(encodeCursor({ id: 0 }), idCursorSchema)).toThrowError(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    );
    expect(() => decodeCursor(encodeCursor({ id: -3 }), idCursorSchema)).toThrowError(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    );
  });
});

describe('sliceWithCursor (pola limit + 1)', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
  const toCursor = (row: { id: number }) => ({ id: row.id });

  it('baris <= limit → tanpa nextCursor', () => {
    const page = sliceWithCursor(rows(3), 3, toCursor);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('baris = limit + 1 → baris ekstra dibuang, nextCursor menunjuk item terakhir', () => {
    const page = sliceWithCursor(rows(4), 3, toCursor);
    expect(page.items.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor, idCursorSchema)).toEqual({ id: 3 });
  });

  it('daftar kosong → aman', () => {
    const page = sliceWithCursor([], 5, toCursor);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
