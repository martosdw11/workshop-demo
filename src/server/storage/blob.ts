import { env } from '../env';
import type { PutResult, StorageAdapter } from './index';

/**
 * Driver `blob` — Vercel Blob (TDD §8.1, A-04).
 *
 * Dipakai saat deploy ke Vercel, di mana filesystem ephemeral membuat driver
 * `local` tidak boleh dipakai. URL publiknya sudah ber-CDN dari penyedia,
 * sehingga route `/api/v1/media/*` tidak dilibatkan sama sekali.
 *
 * `@vercel/blob` di-import DINAMIS supaya deployment yang memakai driver `local`
 * tidak ikut memuat SDK-nya sama sekali.
 */

/**
 * URL publik hanya diketahui setelah upload (penyedia yang menentukannya),
 * sehingga `publicUrl(key)` di driver ini tidak bisa menebak. URL disimpan di
 * `events.cover_url` / `content_json` saat upload — itulah yang dipakai.
 */
const blobUrlCache = new Map<string, string>();

export const blobStorage: StorageAdapter = {
  async put(key, bytes, contentType): Promise<PutResult> {
    const { put } = await import('@vercel/blob');
    const result = await put(key, bytes, {
      access: 'public',
      contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
      // Key sudah unik lewat UUID (§8.2) — penambahan suffix acak hanya akan
      // membuat key di database berbeda dari key di storage.
      addRandomSuffix: false,
    });
    blobUrlCache.set(key, result.url);
    return { key, publicUrl: result.url, bytes: bytes.byteLength };
  },

  async delete(key): Promise<void> {
    const { del } = await import('@vercel/blob');
    const url = blobUrlCache.get(key) ?? key;
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
    blobUrlCache.delete(key);
  },

  publicUrl(key): string {
    return blobUrlCache.get(key) ?? `${env.MEDIA_PUBLIC_HOST.replace(/\/$/, '')}/${key}`;
  },
};
