import type { AllowedImageMime } from '@/lib/constants';
import { uploadKindSchema } from '@/lib/validation/user';
import { requireAdmin } from '@/server/auth/rbac';
import { RATE_LIMITS, enforceRateLimit } from '@/server/cache/ratelimit';
import { env } from '@/server/env';
import { AppError } from '@/server/http/errors';
import { created, withHandler } from '@/server/http/handler';
import { buildStorageKey, storage } from '@/server/storage';

/**
 * `POST /api/v1/admin/uploads` — TDD §8.2, kontrak §3.4.
 * `multipart/form-data`: `file` + `kind`. → `201 {publicUrl, key, bytes}`
 * `422 UNSUPPORTED_MEDIA_TYPE` · `413 FILE_TOO_LARGE`
 *
 * MIME ditentukan dari MAGIC BYTES, bukan dari `Content-Type` yang dikirim
 * browser (§8.2 langkah 2) — header itu sepenuhnya dikendalikan klien.
 */
export const dynamic = 'force-dynamic';

/**
 * Tanda tangan biner tiga format yang diizinkan (§8.3). Deteksi ditulis sendiri,
 * bukan lewat library: hanya tiga format yang perlu dikenali, dan whitelist
 * sesempit ini justru lebih mudah diaudit daripada detektor serba bisa.
 */
function detectImageMime(bytes: Buffer): AllowedImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export const POST = withHandler(async (req, ctx) => {
  const admin = await requireAdmin();
  ctx.setUserId(admin.id);
  await enforceRateLimit(RATE_LIMITS.writeGlobal, String(admin.id));

  const form = await req.formData().catch(() => null);
  if (!form) throw new AppError('BAD_REQUEST', { reason: 'Body harus multipart/form-data.' });

  const kind = uploadKindSchema.parse(form.get('kind') ?? 'material-image');
  const maxBytes =
    kind === 'cover' ? env.UPLOAD_MAX_COVER_BYTES : env.UPLOAD_MAX_IMAGE_BYTES;

  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError('VALIDATION_ERROR', { fields: { file: 'File wajib diunggah.' } });
  }

  // Ditolak dari ukuran yang dilaporkan lebih dulu, sebelum seluruh isi file
  // dimaterialisasi ke memori (§8.2 catatan penutup).
  if (file.size > maxBytes) throw new AppError('FILE_TOO_LARGE', { maxBytes, bytes: file.size });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new AppError('FILE_TOO_LARGE', { maxBytes, bytes: bytes.byteLength });
  }

  const mime = detectImageMime(bytes);
  if (!mime) throw new AppError('UNSUPPORTED_MEDIA_TYPE');

  // Nama file asli TIDAK PERNAH dipakai (§8.2 langkah 3).
  const key = buildStorageKey(kind, mime);
  const result = await storage.put(key, bytes, mime);

  return created({ publicUrl: result.publicUrl, key: result.key, bytes: result.bytes });
});
