import { z } from 'zod';

import { LIMITS, PAGE_SIZE, RESPONSE_TYPES } from '../constants';
import { cursorParam, idNumber, limitParam } from './common';

/** Validasi respons peserta — TDD §9.2 (1–5000 karakter setelah trim). */

export const responseTypeSchema = z.enum(RESPONSE_TYPES, {
  message: 'Tipe respons tidak valid.',
});

export const responseContentSchema = z
  .string()
  .trim()
  .min(LIMITS.responseContentMin, 'Respons tidak boleh kosong.')
  .max(LIMITS.responseContentMax, `Respons maksimal ${LIMITS.responseContentMax} karakter.`);

export const createResponseSchema = z.object({
  type: responseTypeSchema,
  content: responseContentSchema,
});

export const responseListQuerySchema = z.object({
  type: responseTypeSchema.optional(),
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.responses),
});

/** `PATCH /admin/responses/:id/issue-status` (§3.4). */
export const issueStatusSchema = z.object({
  issueStatus: z.enum(['open', 'resolved'], { message: 'Status issue tidak valid.' }),
});

/** `GET /admin/events/:id/responses` (§3.4). */
export const adminResponseQuerySchema = z.object({
  type: responseTypeSchema.optional(),
  materialId: z.coerce.number().int().positive().optional(),
  issueStatus: z.enum(['open', 'resolved']).optional(),
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.eventResponses),
});

/** `GET /admin/activity` (§3.4). */
export const activityQuerySchema = z.object({
  eventId: z.coerce.number().int().positive().optional(),
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.activity),
});

export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type ResponseListQuery = z.infer<typeof responseListQuerySchema>;
export type AdminResponseQuery = z.infer<typeof adminResponseQuerySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

/** Dipakai payload optimistic update FE agar bentuknya sama dengan server. */
export const responseIdSchema = idNumber;
