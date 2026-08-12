import { z } from 'zod';

import { DASHBOARD_PERIODS, PAGE_SIZE, UPLOAD_KINDS } from '../constants';
import { cursorParam, limitParam, searchParam } from './common';

/** Validasi User Access, Participant List, dashboard admin & upload (§3.4). */

export const roleSchema = z.object({
  role: z.enum(['participant', 'admin'], { message: 'Peran tidak valid.' }),
});

export const userStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], { message: 'Status akun tidak valid.' }),
});

export const participantQuerySchema = z.object({
  q: searchParam,
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.participants),
});

/** `GET /admin/events/:id/participants` — matriks peserta × materi (§3.4). */
export const eventParticipantQuerySchema = z.object({
  q: searchParam,
  status: z.enum(['all', 'in_progress', 'completed']).default('all'),
  cursor: cursorParam,
  limit: limitParam(PAGE_SIZE.eventParticipants),
});

export const dashboardPeriodSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('7d'),
});

export const pipelineQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('7d'),
  eventId: z.coerce.number().int().positive().optional(),
});

export const uploadKindSchema = z.enum(UPLOAD_KINDS, { message: 'Jenis upload tidak valid.' });

export type ParticipantQuery = z.infer<typeof participantQuerySchema>;
export type EventParticipantQuery = z.infer<typeof eventParticipantQuerySchema>;
export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;
