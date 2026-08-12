/**
 * Satu-satunya pintu akses data dari client — TDD §1.3.
 *
 * `features/**` dan `components/**` DILARANG meng-import `server/**` (ditegakkan
 * ESLint `no-restricted-imports`); semuanya lewat sini. Server Component tetap
 * boleh memanggil service layer langsung tanpa HTTP hop (A-03).
 *
 * Tugas modul ini persis tiga:
 *   1. menempel base path `/api/v1` + `credentials: 'include'` (§3.1),
 *   2. membongkar amplop `{data, meta}` / `{error:{code,message,details}}` (§9.1),
 *   3. menormalkan SEMUA kegagalan menjadi `ApiError` — termasuk kegagalan
 *      jaringan dan respons non-JSON, supaya pemanggil tidak pernah menerima
 *      dua bentuk error yang berbeda.
 */

export const API_BASE = '/api/v1';

export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };

/**
 * Kegagalan API dalam satu bentuk. `code` adalah kontrak mesin §9.4 — seluruh
 * penanganan error di UI mencocokkan `code`, TIDAK PERNAH mencocokkan string
 * pesan (aturan epic ini).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }

  /** Peta `{field: pesan}` dari `422` (§9.1) untuk ditempel ke input form. */
  get fieldErrors(): Record<string, string> | undefined {
    const fields = this.details?.fields;
    if (!fields || typeof fields !== 'object') return undefined;
    return fields as Record<string, string>;
  }

  get retryAfterSeconds(): number | undefined {
    const value = this.details?.retryAfterSeconds;
    return typeof value === 'number' ? value : undefined;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Dipakai upload multipart — `body` diserahkan apa adanya tanpa header JSON. */
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, QueryValue>;
};

async function parseJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Menerjemahkan body error menjadi `ApiError`. Bila server sempat mengembalikan
 * halaman HTML (mis. 502 dari proxy), `code` jatuh ke `INTERNAL_ERROR` supaya UI
 * tetap punya kode yang bisa dipetakan ke pesan Bahasa Indonesia.
 */
function toApiError(status: number, payload: unknown): ApiError {
  const envelope = payload as { error?: { code?: string; message?: string; details?: unknown } };
  const error = envelope?.error;

  return new ApiError({
    code: typeof error?.code === 'string' ? error.code : fallbackCodeFor(status),
    message: typeof error?.message === 'string' ? error.message : '',
    status,
    details:
      error?.details && typeof error.details === 'object'
        ? (error.details as Record<string, unknown>)
        : undefined,
  });
}

function fallbackCodeFor(status: number): string {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'FILE_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'BAD_REQUEST';
}

/** Kode sintetis untuk kegagalan yang tidak pernah sampai ke server. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal, query } = options;
  const url = `${API_BASE}${path}${buildQuery(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      // Cookie sesi `HttpOnly` (§3.1) — tanpa ini seluruh endpoint menjawab 401.
      credentials: 'include',
      signal,
      headers: formData ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ code: NETWORK_ERROR_CODE, message: '', status: 0 });
  }

  if (response.status === 204) return undefined as T;

  const payload = await parseJsonSafely(response);
  if (!response.ok) throw toApiError(response.status, payload);

  return (payload as ApiEnvelope<T>)?.data as T;
}

/**
 * Varian yang ikut mengembalikan `meta` — dibutuhkan daftar ber-cursor
 * (`meta.nextCursor`, §3.1) seperti katalog, timeline respons, dan activity feed.
 */
export async function apiFetchWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, formData, signal, query } = options;
  const url = `${API_BASE}${path}${buildQuery(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      signal,
      headers: formData ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ code: NETWORK_ERROR_CODE, message: '', status: 0 });
  }

  const payload = await parseJsonSafely(response);
  if (!response.ok) throw toApiError(response.status, payload);

  const envelope = payload as ApiEnvelope<T>;
  return { data: envelope?.data as T, meta: envelope?.meta };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
