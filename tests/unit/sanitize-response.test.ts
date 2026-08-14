import { describe, expect, it } from 'vitest';

import { renderResponseContent } from '@/lib/sanitize-html';

/**
 * Rich editor respons peserta — pola tiga lapis §8.4 (PRUNE → RENDER →
 * SANITIZE) dengan whitelist yang LEBIH SEMPIT dari materi: tanpa `heading`.
 * `image` diizinkan (insert-URL, kebijakan src sama dengan materi). Plain text
 * hasil ekstraksi dipakai `responses.content` (CHECK panjang + snippet admin +
 * scoring), jadi diuji di sini juga.
 */

const OPTS = { mediaPublicHost: 'http://localhost:3000' };
const render = (json: unknown) => renderResponseContent(json, OPTS);

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });

describe('renderResponseContent — render & sanitasi', () => {
  it('paragraf ber-mark bold/italic/code dirender jadi HTML', () => {
    const { html } = render(
      doc(
        p(
          t('tebal', [{ type: 'bold' }]),
          t(' dan '),
          t('kode', [{ type: 'code' }]),
        ),
      ),
    );
    expect(html).toContain('<strong>tebal</strong>');
    expect(html).toContain('<code>kode</code>');
  });

  it('link mendapat rel noopener/noreferrer/nofollow + target _blank', () => {
    const { html } = render(
      doc(p(t('tautan', [{ type: 'link', attrs: { href: 'https://example.com' } }]))),
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it('node heading DIBUANG (di luar whitelist respons)', () => {
    const { html, text } = render(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [t('Judul selundupan')] },
        p(t('isi biasa')),
      ),
    );
    expect(html).not.toContain('<h2');
    expect(html).toContain('isi biasa');
    // Teks di dalam node terlarang ikut hilang bersama node-nya.
    expect(text).toBe('isi biasa');
  });

  it('image https DIPERTAHANKAN; src data:/javascript: dibuang', () => {
    const aman = render(doc({ type: 'image', attrs: { src: 'https://cdn.example/x.png' } }));
    expect(aman.html).toContain('<img src="https://cdn.example/x.png"');

    const berbahaya = render(
      doc({ type: 'image', attrs: { src: 'data:text/html,<script>alert(1)</script>' } }),
    );
    expect(berbahaya.html).not.toContain('<img');
  });

  it('respons hanya-gambar → plain text placeholder [alt|gambar]', () => {
    expect(render(doc({ type: 'image', attrs: { src: 'https://cdn.example/x.png' } })).text).toBe(
      '[gambar]',
    );
    expect(
      render(
        doc({ type: 'image', attrs: { src: 'https://cdn.example/x.png', alt: 'diagram alur' } }),
      ).text,
    ).toBe('[diagram alur]');
  });

  it('teks menyerupai tag TIDAK menjadi elemen (escape, bukan eksekusi)', () => {
    const { html } = render(doc(p(t('<script>alert(1)</script>'))));
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('skema javascript: pada link dibuang sanitasi', () => {
    const { html } = render(
      doc(p(t('klik', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))),
    );
    expect(html).not.toContain('javascript:');
  });
});

describe('renderResponseContent — ekstraksi plain text', () => {
  it('blok dipisah newline; hardBreak menjadi newline', () => {
    const { text } = render(
      doc(p(t('baris satu'), { type: 'hardBreak' }, t('baris dua')), p(t('paragraf dua'))),
    );
    expect(text).toBe('baris satu\nbaris dua\nparagraf dua');
  });

  it('item list ikut terekstraksi', () => {
    const { text } = render(
      doc({
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [p(t('apel'))] },
          { type: 'listItem', content: [p(t('jeruk'))] },
        ],
      }),
    );
    expect(text).toContain('apel');
    expect(text).toContain('jeruk');
  });

  it('dokumen kosong / hanya whitespace → text kosong (ditolak validasi panjang)', () => {
    expect(render(doc()).text).toBe('');
    expect(render(doc(p(t('   ')))).text).toBe('');
    expect(render(null).text).toBe('');
    expect(render({ type: 'bukan-doc' }).text).toBe('');
  });
});
