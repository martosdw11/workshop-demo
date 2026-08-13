import path from 'node:path';

import 'dotenv/config';

/**
 * Akun & lokasi storageState untuk E2E.
 *
 * Kredensial berasal dari akun SEED (`npm run db:seed`) — spec TIDAK pernah
 * register akun untuk kebutuhan auth karena registrasi dibatasi 3/jam/IP.
 * Fallback di bawah sama dengan default smoke.sh dan seed.ts.
 */

const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');

export const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');
export const PARTICIPANT_STATE = path.join(AUTH_DIR, 'participant.json');

export const adminCredentials = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@learningstudy.ai',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
};

/** Akun peserta seed — dipakai HANYA untuk assertion read-only (katalog, RBAC).
 *  Alur yang memutasi progres membuat user `@test.local` sendiri. */
export const participantCredentials = {
  email: process.env.E2E_PARTICIPANT_EMAIL ?? 'andi@example.com',
  password: process.env.E2E_PARTICIPANT_PASSWORD ?? 'Peserta12345',
};
