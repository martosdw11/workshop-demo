import { randomUUID } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { AppError, isAppError, type ErrorCode, type ErrorDetails } from './errors';
import { logRequest, logger } from './logger';

/**
 * Pembungkus SELURUH Route Handler — TDD §9.1.
 *
 * Tugasnya: membuat `requestId`, memetakan exception domain (`AppError`) ke status
 * HTTP + amplop error, mencatat log terstruktur, dan **selalu** mengembalikan
 * `500 INTERNAL_ERROR` generik untuk error tak terduga — tanpa stack trace atau
 * pesan SQL yang bocor ke klien.
 *
 * Route Handler tetap TIPIS (TDD §1.3): validasi → panggil service → serialisasi.
 */

/** Konteks yang diterima handler: params sudah di-await (Next 15 memberinya sebagai Promise). */
export type HandlerContext<P> = {
  params: P;
  requestId: string;
  /** Diisi handler setelah `requireUser()` supaya ikut tercatat di log. */
  setUserId: (userId: number) => void;
};

type NextRouteContext<P> = { params: Promise<P> };

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiError = { error: { code: string; message: string; details?: ErrorDetails } };

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** Amplop sukses `{data, meta}` (§9.1). */
export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit): NextResponse {
  const body: ApiSuccess<T> = meta === undefined ? { data } : { data, meta };
  return NextResponse.json(body, {
    status: 200,
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  });
}

export function created<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return ok(data, meta, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

/** Amplop error `{error:{code,message,details}}` (§9.1). */
function errorResponse(
  code: ErrorCode | string,
  message: string,
  status: number,
  details?: ErrorDetails,
): NextResponse {
  const body: ApiError = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  const headers: Record<string, string> = { ...NO_STORE };

  // `Retry-After` wajib menyertai 429 (§9.3).
  const retryAfter = details?.retryAfterSeconds;
  if (status === 429 && typeof retryAfter === 'number') {
    headers['Retry-After'] = String(Math.max(1, Math.ceil(retryAfter)));
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * IP klien untuk identifier rate limit (§9.3). Di belakang reverse proxy /
 * platform, `x-forwarded-for` berisi daftar — entri pertama adalah klien asli.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function withHandler<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: HandlerContext<P>) => Promise<NextResponse>,
) {
  return async (req: NextRequest, routeCtx: NextRouteContext<P>): Promise<NextResponse> => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const route = new URL(req.url).pathname;

    let userId: number | undefined;
    const setUserId = (id: number) => {
      userId = id;
    };

    const finish = (response: NextResponse, code?: string) => {
      response.headers.set('X-Request-Id', requestId);
      logRequest({
        requestId,
        route,
        method: req.method,
        status: response.status,
        durationMs: Date.now() - startedAt,
        userId,
        code,
      });
      return response;
    };

    try {
      const params = ((await routeCtx?.params) ?? {}) as P;
      const response = await fn(req, { params, requestId, setUserId });
      return finish(response);
    } catch (error) {
      if (isAppError(error)) {
        return finish(
          errorResponse(error.code, error.message, error.status, error.details),
          error.code,
        );
      }

      // Error tak terduga: detail lengkap HANYA ke log, klien menerima 500 generik.
      logger.error(
        {
          requestId,
          route,
          method: req.method,
          userId,
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : error,
        },
        'unhandled error',
      );

      const generic = new AppError('INTERNAL_ERROR');
      return finish(errorResponse(generic.code, generic.message, generic.status), generic.code);
    }
  };
}
