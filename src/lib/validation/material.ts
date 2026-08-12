import { z } from 'zod';

import { LIMITS } from '../constants';
import { idNumber } from './common';

/**
 * Validasi materi & kurikulum — TDD §9.2.
 * Batas 2 level TIDAK diandalkan ke Zod (parentId di sini hanya "ada/tidak ada");
 * penegaknya adalah `CHECK depth IN (0,1)` + trigger + guard service (§2.4).
 */

export const materialTitleSchema = z
  .string()
  .trim()
  .min(2, 'Judul materi minimal 2 karakter.')
  .max(LIMITS.materialTitleMax, `Judul materi maksimal ${LIMITS.materialTitleMax} karakter.`);

export const pointsSchema = z
  .number({ invalid_type_error: 'Poin harus berupa angka.' })
  .int('Poin harus bilangan bulat.')
  .min(LIMITS.pointsMin, 'Poin tidak boleh negatif.')
  .max(LIMITS.pointsMax, `Poin maksimal ${LIMITS.pointsMax}.`);

/**
 * Dokumen TipTap (A-05). Bentuk detailnya tidak divalidasi ketat di sini —
 * node di luar whitelist dibuang saat render + sanitasi di server (§8.4),
 * sehingga menolak dokumen di batas HTTP hanya akan memindahkan kegagalan
 * menjadi error yang tidak bisa diperbaiki admin.
 */
export const contentJsonSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .passthrough()
  .nullish()
  .transform((value) => value ?? null);

export const createMaterialSchema = z.object({
  parentId: idNumber.nullish().transform((value) => value ?? null),
  title: materialTitleSchema,
  contentJson: contentJsonSchema,
  points: pointsSchema.default(0),
});

export const updateMaterialSchema = z
  .object({
    title: materialTitleSchema,
    contentJson: contentJsonSchema,
    points: pointsSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Tidak ada field yang diubah.' });

/**
 * Reorder mengirim SELURUH tree dalam satu request (§6.7) — server yang
 * menghitung ulang `order_index` + `sequence_index` dalam satu transaksi.
 */
export const reorderMaterialsSchema = z.object({
  items: z
    .array(
      z.object({
        id: idNumber,
        parentId: idNumber.nullish().transform((value) => value ?? null),
        orderIndex: z.number().int().min(0),
      }),
    )
    .min(1, 'Daftar materi tidak boleh kosong.')
    .max(500, 'Terlalu banyak materi dalam satu request.'),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type ReorderMaterialsInput = z.infer<typeof reorderMaterialsSchema>;
