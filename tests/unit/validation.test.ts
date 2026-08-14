import { describe, expect, it } from 'vitest';

import { normalizePhone } from '@/lib/phone';
import { renderMaterialContent } from '@/lib/sanitize-html';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { createResponseSchema } from '@/lib/validation/response';
import { decodeCursor, encodeCursor, idCursorSchema } from '@/server/http/pagination';

/** Unit test lapis validasi & sanitasi — TDD §9.2, §8.4. Tidak menyentuh database. */

describe('normalizePhone (TDD §9.2, A-12)', () => {
  it('menormalkan format lokal ke E.164', () => {
    expect(normalizePhone('08123456789')).toBe('+628123456789');
    expect(normalizePhone('+62 812-3456-789')).toBe('+628123456789');
    expect(normalizePhone('0062812345678')).toBe('+62812345678');
    expect(normalizePhone('(0812) 3456 7890')).toBe('+6281234567890');
  });

  it('menolak nomor yang tidak masuk akal', () => {
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('+6281234567890123456')).toBeNull();
  });
});

describe('registerSchema (TDD §9.2)', () => {
  it('menormalkan email & phone, dan menolak password lemah', () => {
    const ok = registerSchema.parse({
      name: '  Budi Santoso ',
      email: ' BUDI@Example.COM ',
      phone: '0812 3456 7890',
      password: 'rahasia123',
    });
    expect(ok.email).toBe('budi@example.com');
    expect(ok.phone).toBe('+6281234567890');
    expect(ok.name).toBe('Budi Santoso');

    const gagal = registerSchema.safeParse({
      name: 'A',
      email: 'bukan-email',
      phone: '08',
      password: 'tanpaangka',
    });
    expect(gagal.success).toBe(false);
  });

  it('MENGABAIKAN field role dari body (guard privilege escalation §5.3)', () => {
    const parsed = registerSchema.parse({
      name: 'Penyusup Test',
      email: 'penyusup@example.com',
      phone: '08123456780',
      password: 'rahasia123',
      role: 'admin',
    });
    expect(parsed).not.toHaveProperty('role');
  });
});

describe('loginSchema', () => {
  it('tidak menerapkan aturan kekuatan password saat login', () => {
    // Aturan kekuatan hanya berlaku saat MEMBUAT password; menolak login karena
    // formatnya lemah akan mengunci akun lama sekaligus membocorkan aturannya.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'lama' }).success).toBe(true);
  });
});

describe('createResponseSchema (TDD §9.2: 1–5000 karakter setelah trim)', () => {
  it('menolak whitespace saja dan konten melebihi batas', () => {
    expect(createResponseSchema.safeParse({ type: 'answer', content: '    ' }).success).toBe(false);
    expect(
      createResponseSchema.safeParse({ type: 'answer', content: 'x'.repeat(5001) }).success,
    ).toBe(false);
    expect(createResponseSchema.safeParse({ type: 'komentar', content: 'ok' }).success).toBe(false);
    expect(createResponseSchema.parse({ type: 'comment', content: '  halo  ' }).content).toBe(
      'halo',
    );
  });
});

describe('cursor pagination (TDD §3.1)', () => {
  it('encode/decode bolak-balik', () => {
    const cursor = encodeCursor({ id: 42 });
    expect(decodeCursor(cursor, idCursorSchema)).toEqual({ id: 42 });
    expect(decodeCursor(null, idCursorSchema)).toBeNull();
  });

  it('cursor rusak menjadi 400 BAD_REQUEST, bukan 500', () => {
    try {
      decodeCursor('!!bukan-cursor!!', idCursorSchema);
      throw new Error('seharusnya melempar');
    } catch (error) {
      expect((error as { code: string; status: number }).code).toBe('BAD_REQUEST');
      expect((error as { status: number }).status).toBe(400);
    }
  });
});

describe('sanitasi rich text (TDD §8.4)', () => {
  const options = { mediaPublicHost: 'http://localhost:3000' };

  it('membuang node di luar whitelist dan memaksa heading ke level 2–3', () => {
    const html = renderMaterialContent(
      {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Judul' }] },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'blok' }] }],
          },
        ],
      },
      options,
    ).contentHtml;

    expect(html).toContain('<h2>Judul</h2>');
    expect(html).not.toContain('blockquote');
    expect(html).not.toContain('blok');
  });

  it('mencabut href javascript: dan atribut event handler', () => {
    const html = renderMaterialContent(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                text: 'klik',
              },
            ],
          },
        ],
      },
      options,
    ).contentHtml;

    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/on[a-z]+=/i);
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  // Mode insert-URL (sementara): https eksternal diizinkan; data:/http eksternal tetap ditolak.
  it('mengizinkan src gambar media sendiri & https eksternal, menolak data: dan http eksternal', () => {
    const html = renderMaterialContent(
      {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: '/api/v1/media/cover/2026/08/aman.png', alt: 'aman' } },
          { type: 'image', attrs: { src: 'https://cdn.example.com/x.png' } },
          { type: 'image', attrs: { src: 'http://insecure.example.com/x.png' } },
          { type: 'image', attrs: { src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } },
        ],
      },
      options,
    ).contentHtml;

    expect(html).toContain('/api/v1/media/cover/2026/08/aman.png');
    expect(html).toContain('https://cdn.example.com/x.png');
    expect(html).not.toContain('insecure.example.com');
    expect(html).not.toContain('data:image');
  });

  it('meng-escape script di dalam code block, bukan mengeksekusinya', () => {
    const html = renderMaterialContent(
      {
        type: 'doc',
        content: [{ type: 'codeBlock', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }],
      },
      options,
    ).contentHtml;

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
