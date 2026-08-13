import { expect, test } from '@playwright/test';

import { participantCredentials } from './helpers/auth';

/**
 * Alur autentikasi lewat UI — register, login, logout.
 *
 * Satu-satunya spec yang menyentuh form register: registrasi dibatasi
 * 3/jam/IP dan global.setup sudah mengosongkan rate_limits di awal run,
 * jadi register di sini dilakukan TEPAT SEKALI per invokasi test.
 */

test.use({ storageState: { cookies: [], origins: [] } });

function freshParticipant() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: 'Peserta E2E',
    email: `e2e-${stamp}@test.local`,
    phone: `0812${stamp.slice(-8)}`,
    password: 'rahasia123',
  };
}

test('register akun baru → otomatis login dan mendarat di dashboard', async ({ page }) => {
  const input = freshParticipant();

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Buat akun baru' })).toBeVisible();

  await page.getByLabel('Nama Lengkap').fill(input.name);
  await page.getByLabel('Email').fill(input.email);
  await page.getByLabel('No. HP').fill(input.phone);
  await page.getByLabel('Password', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Register sukses = auto-login + redirect; tidak ada toast (by design).
  await page.waitForURL('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome back, Peserta/ })).toBeVisible();
});

test('login password salah → banner error, tetap di /login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.getByLabel('Email').fill(participantCredentials.email);
  await page.getByLabel('Password', { exact: true }).fill('salahsekali9');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Route announcer Next.js juga ber-role alert — sasar banner form saja.
  await expect(page.locator('p[role="alert"]')).toContainText('Email atau password salah.');
  await expect(page).toHaveURL(/\/login/);
});

test('login peserta seed → dashboard, logout → kembali terkunci', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(participantCredentials.email);
  await page.getByLabel('Password', { exact: true }).fill(participantCredentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');

  // Logout lewat dropdown akun di TopNavBar.
  await page.getByRole('button', { name: 'Menu akun' }).click();
  await page.getByRole('menuitem', { name: 'Keluar' }).click();
  await page.waitForURL(/\/login/);

  // Halaman terlindungi kembali me-redirect dengan parameter next (middleware).
  await page.goto('/dashboard');
  await page.waitForURL(/\/login\?next=%2Fdashboard/);
});
