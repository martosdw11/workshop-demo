import pino from 'pino';

import { env } from '../env';

/**
 * Structured logging — TDD §11.3.
 *
 * Wajib memuat `requestId`, `userId`, `route`, `status`, `durationMs`.
 * DILARANG mencatat password, token sesi, atau isi respons peserta — daftar
 * `redact` di bawah adalah jaring pengaman terakhir bila suatu saat ada objek
 * yang tidak sengaja ikut ter-log utuh.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: 'learning-study-ai' },
  redact: {
    paths: [
      'password',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      'token',
      '*.token',
      '*.tokenHash',
      '*.token_hash',
      'cookie',
      'req.headers.cookie',
      'req.headers.authorization',
      'content',
      '*.content',
      'temporaryPassword',
      '*.temporaryPassword',
    ],
    censor: '[redacted]',
  },
  /**
   * SENGAJA tanpa `transport` (mis. pino-pretty). Transport pino berjalan di
   * worker thread; di dalam bundel Next.js worker itu mati begitu modul
   * dievaluasi ulang saat hot reload, dan setiap panggilan log berikutnya
   * melempar "the worker has exited" — mengubah error biasa menjadi crash proses.
   * Output tetap JSON satu baris di semua environment, sesuai TDD §11.3.
   */
});

export type RequestLogFields = {
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  userId?: number;
  code?: string;
};

/** Ambang audit query/route lambat (TDD §11.4 — "tidak ada query > 200 ms di log"). */
export const SLOW_REQUEST_MS = 200;

export function logRequest(fields: RequestLogFields): void {
  if (fields.status >= 500) {
    logger.error(fields, 'request failed');
    return;
  }
  if (fields.status >= 400) {
    logger.warn(fields, 'request rejected');
    return;
  }
  if (fields.durationMs > SLOW_REQUEST_MS) {
    logger.warn({ ...fields, slow: true }, 'request slow');
    return;
  }
  logger.info(fields, 'request ok');
}
