import Image from '@tiptap/extension-image';
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import sanitizeHtml from 'sanitize-html';

import { ALLOWED_TIPTAP_MARKS, ALLOWED_TIPTAP_NODES } from './constants';

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

/** Heading dibatasi level 2–3 (§8.4) — h1 dicadangkan untuk judul materi. */
const ALLOWED_HEADING_LEVELS = [2, 3] as const;

type TipTapNode = {
  type?: string;
  content?: unknown[];
  marks?: unknown[];
  attrs?: Record<string, unknown>;
  text?: string;
};

function pruneNode(node: unknown): TipTapNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const input = node as TipTapNode;
  if (typeof input.type !== 'string' || !ALLOWED_NODES.has(input.type)) return null;

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
      return typeof type === 'string' && ALLOWED_MARKS.has(type);
    });
  }

  if (Array.isArray(input.content)) {
    output.content = input.content
      .map(pruneNode)
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
  /** Host media milik sendiri — `src` gambar di luar ini dibuang (§8.4). */
  mediaPublicHost: string;
};

function isAllowedImageSrc(src: string, mediaPublicHost: string): boolean {
  // Media lokal disajikan Route Handler kita sendiri.
  if (src.startsWith('/api/v1/media/')) return true;
  try {
    const url = new URL(src);
    const host = new URL(mediaPublicHost);
    if (url.origin === host.origin) return true;
    // Driver `blob` menyajikan dari domain penyedia; whitelist-nya eksplisit.
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    // Bukan URL absolut dan bukan path media kita → hotlink/`data:`/`javascript:` → tolak.
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
