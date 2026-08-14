import Image from '@tiptap/extension-image';
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import sanitizeHtml from 'sanitize-html';

import {
  ALLOWED_RESPONSE_MARKS,
  ALLOWED_RESPONSE_NODES,
  ALLOWED_TIPTAP_MARKS,
  ALLOWED_TIPTAP_NODES,
} from './constants';

/**
 * Sanitasi rich text — TDD §8.4.
 *
 * Konten materi ditulis admin, tapi tetap diperlakukan UNTRUSTED: admin bisa saja
 * akun yang dikompromikan, dan HTML-nya dirender ke ratusan peserta.
 *
 * Tiga lapis, urutannya penting:
 *   1. PRUNE — node/mark TipTap di luar whitelist dibuang dari JSON sebelum render.
 *   2. RENDER — `content_json` → HTML memakai skema TipTap (A-05).
 *   3. SANITIZE — `sanitize-html` membuang sisa tag/atribut berbahaya.
 *
 * Semuanya berjalan DI SERVER (service layer). Memindahkannya ke komponen client
 * dilarang walau FE dan BE satu codebase (§8.4).
 */

const ALLOWED_NODES = new Set<string>(ALLOWED_TIPTAP_NODES);
const ALLOWED_MARKS = new Set<string>(ALLOWED_TIPTAP_MARKS);

/** Whitelist respons peserta — tanpa heading & image (lihat constants.ts). */
const RESPONSE_NODES = new Set<string>(ALLOWED_RESPONSE_NODES);
const RESPONSE_MARKS = new Set<string>(ALLOWED_RESPONSE_MARKS);

/** Heading dibatasi level 2–3 (§8.4) — h1 dicadangkan untuk judul materi. */
const ALLOWED_HEADING_LEVELS = [2, 3] as const;

type TipTapNode = {
  type?: string;
  content?: unknown[];
  marks?: unknown[];
  attrs?: Record<string, unknown>;
  text?: string;
};

function pruneNode(
  node: unknown,
  allowedNodes: Set<string> = ALLOWED_NODES,
  allowedMarks: Set<string> = ALLOWED_MARKS,
): TipTapNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const input = node as TipTapNode;
  if (typeof input.type !== 'string' || !allowedNodes.has(input.type)) return null;

  const output: TipTapNode = { type: input.type };

  if (typeof input.text === 'string') output.text = input.text;

  if (input.attrs && typeof input.attrs === 'object') {
    output.attrs = { ...input.attrs };
    if (input.type === 'heading') {
      const level = Number(output.attrs.level);
      output.attrs.level = (ALLOWED_HEADING_LEVELS as readonly number[]).includes(level)
        ? level
        : ALLOWED_HEADING_LEVELS[0];
    }
  }

  if (Array.isArray(input.marks)) {
    output.marks = input.marks.filter((mark) => {
      if (typeof mark !== 'object' || mark === null) return false;
      const type = (mark as { type?: unknown }).type;
      return typeof type === 'string' && allowedMarks.has(type);
    });
  }

  if (Array.isArray(input.content)) {
    output.content = input.content
      .map((child) => pruneNode(child, allowedNodes, allowedMarks))
      .filter((child): child is TipTapNode => child !== null);
  }

  return output;
}

/** Dokumen kosong yang valid — dipakai bila `content_json` null atau tak dikenal. */
const EMPTY_DOC = { type: 'doc', content: [] };

const extensions = [
  StarterKit.configure({ heading: { levels: [...ALLOWED_HEADING_LEVELS] } }),
  Image,
];

export type SanitizeOptions = {
  /** Host media milik sendiri — origin ini selalu diizinkan (termasuk http di dev). */
  mediaPublicHost: string;
};

/**
 * KEBIJAKAN SEMENTARA (mode insert-URL, §8.4 dilonggarkan sadar): selama fitur
 * upload dinonaktifkan, admin menempelkan URL gambar eksternal, jadi `src`
 * https dari host mana pun diizinkan. `data:`, `javascript:`, dan http eksternal
 * (mixed content) tetap ditolak. Saat kembali ke mode upload, kembalikan
 * whitelist host di sini DAN di `img-src` CSP (next.config.ts).
 */
function isAllowedImageSrc(src: string, mediaPublicHost: string): boolean {
  // Media lokal disajikan Route Handler kita sendiri.
  if (src.startsWith('/api/v1/media/')) return true;
  try {
    const url = new URL(src);
    const host = new URL(mediaPublicHost);
    if (url.origin === host.origin) return true;
    return url.protocol === 'https:';
  } catch {
    // Bukan URL absolut dan bukan path media kita → `data:`/`javascript:` → tolak.
    return false;
  }
}

export function sanitizeMaterialHtml(html: string, options: SanitizeOptions): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'pre', 'code', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
      pre: ['class'],
    },
    // `<script>`, `<style>`, `<iframe>`, seluruh atribut `on*`, dan `style` inline
    // tidak ada di whitelist, jadi otomatis dibuang beserta isinya.
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe'],
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      // Link eksternal tidak boleh mendapat akses `window.opener`.
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      img: (tagName, attribs) => {
        const src = typeof attribs.src === 'string' ? attribs.src : '';
        if (!isAllowedImageSrc(src, options.mediaPublicHost)) {
          // `src` dikosongkan lalu tag-nya dibuang `exclusiveFilter` di bawah.
          const { src: _dropped, ...rest } = attribs;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}

/**
 * `content_json` → `content_html` tersanitasi. Inilah satu-satunya jalan konten
 * materi boleh berubah menjadi HTML; kolom `content_html` di database SELALU
 * merupakan keluaran fungsi ini.
 */
export function renderMaterialContent(
  contentJson: unknown,
  options: SanitizeOptions,
): { contentJson: unknown; contentHtml: string } {
  const pruned = pruneNode(contentJson) ?? EMPTY_DOC;
  const doc = pruned.type === 'doc' ? pruned : EMPTY_DOC;

  let rawHtml: string;
  try {
    rawHtml = generateHTML(doc as never, extensions);
  } catch {
    // Dokumen tetap ditolak jadi HTML, tapi tidak boleh menjatuhkan request admin.
    rawHtml = '';
  }

  return { contentJson: doc, contentHtml: sanitizeMaterialHtml(rawHtml, options) };
}

/**
 * Sanitasi HTML respons peserta — subset dari `sanitizeMaterialHtml`:
 * tanpa `h2`/`h3` (heading dicadangkan untuk materi). `img` diizinkan dengan
 * kebijakan `src` yang sama persis dengan materi (`isAllowedImageSrc`).
 * Aturan link sama: `rel="noopener noreferrer nofollow"` + `target="_blank"`.
 */
export function sanitizeResponseHtml(html: string, options: SanitizeOptions): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'pre', 'code', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
      pre: ['class'],
    },
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe'],
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      img: (tagName, attribs) => {
        const src = typeof attribs.src === 'string' ? attribs.src : '';
        if (!isAllowedImageSrc(src, options.mediaPublicHost)) {
          const { src: _dropped, ...rest } = attribs;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}

/** Node yang anak-anaknya dipisah newline saat ekstraksi plain text. */
const RESPONSE_BLOCK_CONTAINERS = new Set(['doc', 'bulletList', 'orderedList', 'listItem']);

function extractText(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') {
    // Placeholder teks agar respons yang HANYA berisi gambar tetap lolos CHECK
    // panjang `content` dan punya snippet yang bermakna di layar admin.
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    return `[${alt || 'gambar'}]`;
  }
  const children = Array.isArray(node.content) ? (node.content as TipTapNode[]) : [];
  const parts = children.map(extractText);
  return parts.join(RESPONSE_BLOCK_CONTAINERS.has(node.type ?? '') ? '\n' : '');
}

/**
 * Dokumen editor respons → `{ contentJson, text, html }`.
 *
 * - `text`  — plain text hasil ekstraksi; disimpan di `responses.content`
 *             (snippet admin, CHECK panjang 1–5000, scoring §4.3 tidak berubah).
 * - `html`  — HTML tersanitasi; disimpan di `responses.content_html` dan inilah
 *             yang dirender timeline. Pola tiga lapis §8.4 yang sama dengan
 *             materi: PRUNE → RENDER → SANITIZE, semuanya DI SERVER.
 */
export function renderResponseContent(
  contentJson: unknown,
  options: SanitizeOptions,
): {
  contentJson: unknown;
  text: string;
  html: string;
} {
  const pruned = pruneNode(contentJson, RESPONSE_NODES, RESPONSE_MARKS) ?? EMPTY_DOC;
  const doc = pruned.type === 'doc' ? pruned : EMPTY_DOC;

  let rawHtml: string;
  try {
    rawHtml = generateHTML(doc as never, extensions);
  } catch {
    rawHtml = '';
  }

  return {
    contentJson: doc,
    text: extractText(doc as TipTapNode).trim(),
    html: sanitizeResponseHtml(rawHtml, options),
  };
}
