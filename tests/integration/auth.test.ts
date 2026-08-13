import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/server/auth/session';
import { countActiveSessions, validateSessionToken } from '@/server/auth/session';
import { closeDb } from '@/server/db/client';
import { login, register } from '@/server/services/auth.service';
import { resetUserPassword, updateUserStatus } from '@/server/services/user.service';

import { cleanupTestData, createTestUser } from '../helpers/fixtures';

/**
 * Integrasi autentikasi & siklus sesi — TDD §5.1, §5.3.
 *
 * Sebelumnya perilaku ini hanya dibuktikan smoke.sh lewat HTTP; di sini dipanggil
 * langsung di service layer supaya bisa jalan tanpa server hidup dan tanpa
 * terbentur rate limit registrasi 3/jam/IP.
 */

let admin: SessionUser;
let counter = 0;

function freshRegisterInput() {
  counter += 1;
  const stamp = `${process.pid}${counter}`;
  return {
    name: `Auth Test ${stamp}`,
    email: `auth${stamp}@test.local`,
    phone: `+62812${String(Date.now()).slice(-8)}${counter % 10}`,
    password: 'rahasia123',
  };
}

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestUser({ role: 'admin' });
});

afterAll(async () => {
  await cleanupTestData();
  await closeDb();
});

describe('register (TDD §5.3)', () => {
  it('selalu lahir sebagai participant dan langsung punya sesi valid', async () => {
    const input = freshRegisterInput();
    const { user, session } = await register(input, { userAgent: 'vitest' });

    expect(user.role).toBe('participant');
    expect(user.email).toBe(input.email);
    expect(session.token).toBeTruthy();

    const sessionUser = await validateSessionToken(session.token);
    expect(sessionUser?.id).toBe(user.id);
    expect(sessionUser?.role).toBe('participant');
  });

  it('email duplikat ditolak 409 EMAIL_TAKEN dari UNIQUE constraint', async () => {
    const input = freshRegisterInput();
    await register(input, { userAgent: 'vitest' });

    await expect(
      register({ ...freshRegisterInput(), email: input.email }, { userAgent: 'vitest' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', status: 409 });
  });
});

describe('login (TDD §5.1)', () => {
  it('password salah → INVALID_CREDENTIALS (dikembalikan, bukan dilempar)', async () => {
    const input = freshRegisterInput();
    await register(input, { userAgent: 'vitest' });

    const outcome = await login(
      { email: input.email, password: 'salahsekali9', rememberMe: false },
      { userAgent: 'vitest' },
    );
    expect(outcome).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
  });

  it('email tidak terdaftar → INVALID_CREDENTIALS yang sama (tidak bocor)', async () => {
    const outcome = await login(
      { email: 'tidak-ada@test.local', password: 'rahasia123', rememberMe: false },
      { userAgent: 'vitest' },
    );
    expect(outcome).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
  });

  it('akun nonaktif dengan password BENAR → ACCOUNT_INACTIVE', async () => {
    const input = freshRegisterInput();
    const { user } = await register(input, { userAgent: 'vitest' });
    await updateUserStatus(user.id, 'inactive', admin);

    const outcome = await login(
      { email: input.email, password: input.password, rememberMe: false },
      { userAgent: 'vitest' },
    );
    expect(outcome).toEqual({ ok: false, reason: 'ACCOUNT_INACTIVE' });
  });
});

describe('revoke sesi (TDD §5.3)', () => {
  it('menonaktifkan akun mencabut SELURUH sesinya seketika', async () => {
    const input = freshRegisterInput();
    const { user, session } = await register(input, { userAgent: 'vitest' });
    expect(await countActiveSessions(user.id)).toBe(1);

    await updateUserStatus(user.id, 'inactive', admin);

    expect(await countActiveSessions(user.id)).toBe(0);
    expect(await validateSessionToken(session.token)).toBeNull();
  });

  it('reset password: password lama mati, sementara hidup, sesi lama dicabut', async () => {
    const input = freshRegisterInput();
    const { user, session } = await register(input, { userAgent: 'vitest' });

    const { temporaryPassword } = await resetUserPassword(user.id);
    expect(temporaryPassword).toHaveLength(16);

    // Sesi lama tidak boleh selamat dari reset (§5.1).
    expect(await validateSessionToken(session.token)).toBeNull();

    const lama = await login(
      { email: input.email, password: input.password, rememberMe: false },
      { userAgent: 'vitest' },
    );
    expect(lama).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });

    const baru = await login(
      { email: input.email, password: temporaryPassword, rememberMe: false },
      { userAgent: 'vitest' },
    );
    expect(baru.ok).toBe(true);
  });
});
