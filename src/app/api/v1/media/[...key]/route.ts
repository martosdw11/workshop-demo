import { NextResponse } from 'next/server';

import { env } from '@/server/env';
import { AppError } from '@/server/http/errors';
import { withHandler } from '@/server/http/handler';
import { CONTENT_TYPE_BY_EXTENSION, assertSafeKey } from '@/server/storage';
import { readLocalMedia } from '@/server/storage/local';

/**
 * `GET /api/v1/media/[...key]` — penyajian media saat `STORAGE_DRIVER=local` (§8.1).
 *
 * Key selalu unik per upload (UUID, §8.2), sehingga isinya tidak pernah berubah —
 * itulah yang membuat `Cache-Control: immutable` benar, bukan sekadar agresif.
 *
 * Endpoint ini PUBLIK: cover event dan gambar materi dirender sebagai `<img>`,
 * dan key acak 128-bit tidak bisa ditebak. Tidak ada data pribadi yang disajikan
 * lewat jalur ini.
 */
export const dynamic = 'force-dynamic';

type Params = { key: string[] };

export const GET = withHandler<Params>(async (_req, ctx) => {
  if (env.STORAGE_DRIVER !== 'local') {
    // Driver `blob` menyajikan langsung dari URL penyedia; route ini tidak dipakai.
    throw new AppError('NOT_FOUND');
  }

  const segments = ctx.params.key ?? [];
  const key = segments.join('/');
  assertSafeKey(key);

  const bytes = await readLocalMedia(key);
  if (!bytes) throw new AppError('NOT_FOUND');

  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Media tidak pernah dieksekusi sebagai skrip walau ada yang menyelundupkan
      // konten lain di dalam file gambar.
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
