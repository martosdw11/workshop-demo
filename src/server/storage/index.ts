import { randomUUID } from 'node:crypto';

import type { AllowedImageMime, UploadKind } from '@/lib/constants';

import { env } from '../env';
import { AppError } from '../http/errors';
import { blobStorage } from './blob';
import { localStorage } from './local';

/**
 * Adapter media — TDD §8.1 & asumsi A-04.
 *
 * Kode aplikasi HANYA memanggil antarmuka ini dan tidak tahu-menahu soal driver.
 * Memindahkan media ke S3 di kemudian hari cukup menambah satu file implementasi,
 * tanpa menyentuh service maupun UI.
 */

export type PutResult = { key: string; publicUrl: string; bytes: number };

export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string): Promise<PutResult>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const storage: StorageAdapter = env.STORAGE_DRIVER === 'blob' ? blobStorage : localStorage;

const EXTENSION_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Key `{kind}/{yyyy}/{mm}/{uuid}.{ext}` — TDD §8.2 langkah 3.
 * NAMA FILE ASLI TIDAK PERNAH DIPAKAI: itu yang menutup path traversal sekaligus
 * tabrakan nama, dan membuat key selalu unik sehingga aman di-cache `immutable`.
 */
export function buildStorageKey(kind: UploadKind, mime: AllowedImageMime): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${kind}/${yyyy}/${mm}/${randomUUID()}.${EXTENSION_BY_MIME[mime]}`;
}

/**
 * Key yang datang dari luar (route `/api/v1/media/[...key]`) tidak boleh bisa
 * keluar dari direktori media. Pemeriksaan dilakukan pada BENTUK key, sebelum
 * menyentuh filesystem.
 */
export function assertSafeKey(key: string): void {
  const invalid =
    key.length === 0 ||
    key.length > 300 ||
    key.startsWith('/') ||
    key.includes('..') ||
    key.includes('\\') ||
    key.includes('\0') ||
    !/^[A-Za-z0-9/_.-]+$/.test(key);

  if (invalid) throw new AppError('BAD_REQUEST', { reason: 'Key media tidak valid.' });
}

export const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
