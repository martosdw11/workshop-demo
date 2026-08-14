import { z } from 'zod';

import { EVENT_CATALOG_FILTERS, LIMITS, PAGE_SIZE } from '../constants';
import { cursorParam, isoDateTime, limitParam, searchParam } from './common';

/** Validasi event — TDD §9.2 (`end_at > start_at`, `quota > 0` atau null). */

export const eventTitleSchema = z
  .string()
  .trim()
  .min(3, 'Judul event minimal 3 karakter.')
  .max(LIMITS.eventTitleMax, `Judul event maksimal ${LIMITS.eventTitleMax} karakter.`);

export const eventDescriptionSchema = z
  .string()
  .trim()
  .max(5000, 'Deskripsi maksimal 5000 karakter.')
  .nullish()
  .transform((value) => (value === '' ? null : (value ?? null)));

/** `null` = tanpa batas peserta (TDD §2.3). */
export const quotaSchema = z
  .number({ invalid_type_error: 'Kuota harus berupa angka.' })
  .int('Kuota harus bilangan bulat.')
  .positive('Kuota harus lebih besar dari 0.')
  .max(100_000, 'Kuota terlalu besar.')
  .nullish()
  .transform((value) => value ?? null);

/**
 * Cover berupa URL: path `/api/v1/media/…` (peninggalan mode upload) atau URL
 * absolut http(s) — mode insert-URL sementara menerima gambar yang dihosting
 * eksternal. Validasi bentuknya di sini; host disaring lagi saat render (§8.4).
 */
export const coverUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value.startsWith('/api/v1/media/') || /^https?:\/\//.test(value), {
    message: 'URL cover tidak valid.',
  })
  .nullish()
  .transform((value) => (value === '' ? null : (value ?? null)));

const scheduleRefine = <T extends { startAt?: string; endAt?: string }>(schema: z.ZodType<T>) =>
  schema.superRefine((value, ctx) => {
    if (value.startAt && value.endAt && new Date(value.endAt) <= new Date(value.startAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endAt'],
        message: 'Tanggal selesai harus setelah tanggal mulai.',
      });
    }
  });

export const createEventSchema = scheduleRefine(
  z.object({
    title: eventTitleSchema,
    description: eventDescriptionSchema,
    startAt: isoDateTime,
    endAt: isoDateTime,
    quota: quotaSchema,
    coverUrl: coverUrlSchema,
  }),
);

export const updateEventSchema = scheduleRefine(
  z
    .object({
      title: eventTitleSchema,
      description: eventDescriptionSchema,
      startAt: isoDateTime,
      endAt: isoDateTime,
      quota: quotaSchema,
      coverUrl: coverUrlSchema,
    })
    .partial(),
).refine((value) => Object.keys(value).length > 0, {
  message: 'Tidak ada field yang diubah.',
});

/** `POST /admin/events/:id/publish` menerima dua arah: publish & kembali ke draft. */
export const publishEventSchema = z.object({
  status: z.enum(['published', 'draft'], { message: 'Status hanya boleh published atau draft.' }),
});

/** Katalog peserta (§3.3): filter turunan status + jadwal (A-11). */
export const catalogQuerySchema = z.object({
  status: z.enum(EVENT_CATALOG_FILTERS).default('all'),
  q: searchParam,
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.catalog),
});

/** Daftar event admin (§3.4): filter memakai status mentah `event_status`. */
export const adminEventQuerySchema = z.object({
  status: z.enum(['all', 'draft', 'published', 'finished']).default('all'),
  q: searchParam,
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.adminEvents),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type AdminEventQuery = z.infer<typeof adminEventQuerySchema>;
