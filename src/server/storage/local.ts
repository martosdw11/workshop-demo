import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { env } from '../env';
import { AppError } from '../http/errors';
import type { PutResult, StorageAdapter } from './index';

/**
 * Driver `local` — TDD §8.1.
 *
 * Menyimpan ke volume disk `LOCAL_STORAGE_DIR` dan menyajikannya lewat Route
 * Handler `/api/v1/media/[...key]`. Dipakai untuk deploy satu container Docker
 * (volume di-mount) dan development lokal.
 *
 * DILARANG dipakai di Vercel: filesystem di sana ephemeral, media akan hilang
 * setiap deploy (§8.1).
 */

function baseDir(): string {
  return resolve(process.cwd(), env.LOCAL_STORAGE_DIR ?? './storage/uploads');
}

/**
 * Lapis kedua setelah `assertSafeKey()`: path hasil resolve WAJIB berada di dalam
 * direktori media. Dua pemeriksaan yang saling bebas, karena satu kesalahan di
 * validasi bentuk key tidak boleh langsung berarti akses ke seluruh filesystem.
 */
function resolveKeyPath(key: string): string {
  const root = baseDir();
  const target = resolve(root, key);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new AppError('BAD_REQUEST', { reason: 'Key media tidak valid.' });
  }
  return target;
}

export const localStorage: StorageAdapter = {
  async put(key, bytes): Promise<PutResult> {
    const target = resolveKeyPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { key, publicUrl: localStorage.publicUrl(key), bytes: bytes.byteLength };
  },

  async delete(key): Promise<void> {
    try {
      await unlink(resolveKeyPath(key));
    } catch {
      // Menghapus file yang sudah tidak ada bukan kegagalan.
    }
  },

  publicUrl(key): string {
    return `/api/v1/media/${key}`;
  },
};

/** Dipakai Route Handler `/api/v1/media/[...key]`. `null` bila file tidak ada. */
export async function readLocalMedia(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKeyPath(key));
  } catch {
    return null;
  }
}

export const localMediaRoot = (): string => join(baseDir());
