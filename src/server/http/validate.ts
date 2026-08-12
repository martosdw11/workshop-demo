import type { NextRequest } from 'next/server';
import type { ZodError, ZodTypeAny, output } from 'zod';

import { AppError } from './errors';

/**
 * Parsing input dengan Zod — TDD §9.2.
 *
 * Kegagalan validasi SELALU menjadi `422 VALIDATION_ERROR` dengan
 * `details.fields` berisi peta `{field: pesan}` supaya FE bisa menempelkannya
 * langsung ke input (§9.1). Zod hanya lapis pesan ramah; kebenaran terakhir tetap
 * constraint database (§9.2).
 */

function fieldsFrom(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // Pesan pertama per field sudah cukup untuk ditempel di input.
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', { fields: fieldsFrom(result.error) });
  }
  return result.data;
}

/** Body JSON. Body kosong/rusak → `400 BAD_REQUEST` (bukan 500). */
export async function parseBody<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError('BAD_REQUEST', { reason: 'Body harus berupa JSON yang valid.' });
  }
  return parseOrThrow(schema, raw);
}

/**
 * Body opsional — dipakai endpoint yang kontraknya "tanpa body" tapi klien
 * (mis. fetch dengan `Content-Type: application/json`) tetap mengirim `{}`.
 */
export async function parseOptionalBody<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<output<S>> {
  const text = await req.text();
  if (text.trim() === '') return parseOrThrow(schema, {});
  try {
    return parseOrThrow(schema, JSON.parse(text));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('BAD_REQUEST', { reason: 'Body harus berupa JSON yang valid.' });
  }
}

/** Query string. Parameter berulang diambil nilai terakhirnya. */
export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): output<S> {
  const raw: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return parseOrThrow(schema, raw);
}

/** Route params (`[eventId]`, `[...key]`). */
export function parseParams<S extends ZodTypeAny>(params: unknown, schema: S): output<S> {
  return parseOrThrow(schema, params);
}
