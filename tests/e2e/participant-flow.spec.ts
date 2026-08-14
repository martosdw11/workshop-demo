import {
  expect,
  request as pwRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';

import { ADMIN_STATE } from './helpers/auth';
import { TEST_PASSWORD, createTestUser } from './helpers/db';

/**
 * Alur peserta lengkap lewat browser — padanan UI dari tests/http/smoke.sh §3–4:
 * katalog → join → player (lock sequential) → jawab → complete → finish → result
 * → dashboard.
 *
 * Precondition (event published + user peserta) dibuat lewat API admin dan
 * fixture DB — bukan lewat UI builder — karena mereka BUKAN objek uji spec ini.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const STAMP = `${Date.now()}`;
const EVENT_TITLE = `[TEST] E2E Flow ${STAMP}`;
const MATERI_1 = 'Materi Satu';
const MATERI_2 = 'Materi Dua';

test.use({ storageState: { cookies: [], origins: [] } });

let adminApi: APIRequestContext;
let eventId: number;

function docWith(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

test.beforeAll(async () => {
  adminApi = await pwRequest.newContext({ baseURL: BASE_URL, storageState: ADMIN_STATE });

  const created = await adminApi.post('/api/v1/admin/events', {
    data: {
      title: EVENT_TITLE,
      description: 'Event uji alur peserta E2E.',
      startAt: new Date(Date.now() - 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      quota: null,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  eventId = (await created.json()).data.event.id;

  for (const material of [
    { title: MATERI_1, points: 60 },
    { title: MATERI_2, points: 40 },
  ]) {
    const response = await adminApi.post(`/api/v1/admin/events/${eventId}/materials`, {
      data: {
        parentId: null,
        title: material.title,
        points: material.points,
        contentJson: docWith(`Konten ${material.title}.`),
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }

  const published = await adminApi.post(`/api/v1/admin/events/${eventId}/publish`, {
    data: { status: 'published' },
  });
  expect(published.status(), await published.text()).toBe(200);
});

test.afterAll(async () => {
  await adminApi.dispose();
});

test('katalog → join → belajar → finish → result → dashboard', async ({ page, context }) => {
  // Peserta segar per INVOKASI test (bukan per worker) supaya alur enroll tetap
  // idempoten saat --repeat-each, dan TIDAK memakai akun seed supaya progres/
  // poin yang dimutasi ikut terhapus bersih oleh cleanup `@test.local`.
  const participantEmail = (await createTestUser()).email;

  // Login via API pada context yang sama — cookie langsung dipakai browser.
  const login = await context.request.post('/api/v1/auth/login', {
    data: { email: participantEmail, password: TEST_PASSWORD },
  });
  expect(login.ok(), await login.text()).toBeTruthy();

  // --- Katalog & join --------------------------------------------------------
  // Filter lewat URL, BUKAN mengetik di kotak cari: debounce 300 ms kotak cari
  // menulis ?q= belakangan dan refresh RSC-nya me-remount daftar kartu — dialog
  // join yang sedang terbuka ikut tercabut dari DOM (flaky).
  await page.goto(`/catalog?q=${encodeURIComponent(EVENT_TITLE)}`);

  const card = page.locator('article', { hasText: EVENT_TITLE });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Join Event' }).click();

  const joinDialog = page.getByRole('dialog');
  await expect(joinDialog).toContainText('Confirm Joining');
  await joinDialog.getByRole('button', { name: 'Join Event' }).click();

  // Enroll sukses tidak ber-toast; sinyalnya redirect ke materi pertama.
  await page.waitForURL(new RegExp(`/events/${eventId}/materials/\\d+$`));

  // --- Player: lock sequential ------------------------------------------------
  await expect(page.getByRole('heading', { name: MATERI_1 })).toBeVisible();
  // Materi 2 terkunci: dirender sebagai <span aria-disabled>, bukan link.
  await expect(
    page.locator('span[aria-disabled="true"]', { hasText: MATERI_2 }),
  ).toBeVisible();

  // --- Jawab materi 1 lalu Next (Next = complete + navigasi) ------------------
  // Composer kini rich editor (contenteditable), bukan <textarea> — placeholder
  // menjadi aria-label, dan hasil kirim dicek DI TIMELINE (<li>) supaya tidak
  // bentrok dengan teks yang mungkin masih ada di editor.
  await page.getByLabel('Tulis jawaban Anda di sini…').fill('Jawaban materi satu.');
  await page.getByRole('button', { name: 'Submit Response' }).click();
  await expect(page.getByRole('listitem').getByText('Jawaban materi satu.')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('+60 poin diperoleh')).toBeVisible();
  await page.waitForURL(new RegExp(`/events/${eventId}/materials/\\d+$`));
  await expect(page.getByRole('heading', { name: MATERI_2 })).toBeVisible();

  // --- Jawab materi terakhir lalu Finish --------------------------------------
  await page.getByLabel('Tulis jawaban Anda di sini…').fill('Jawaban materi dua.');
  await page.getByRole('button', { name: 'Submit Response' }).click();
  await expect(page.getByRole('listitem').getByText('Jawaban materi dua.')).toBeVisible();

  await page.getByRole('button', { name: 'Finish' }).click();
  const finishDialog = page.getByRole('dialog');
  await expect(finishDialog).toContainText('Selesaikan event ini?');
  await finishDialog.getByRole('button', { name: 'Finish' }).click();

  // --- Result -----------------------------------------------------------------
  await page.waitForURL(`/events/${eventId}/result`);
  await expect(page.getByRole('heading', { name: EVENT_TITLE })).toBeVisible();
  await expect(page.getByText(/100\s*\/\s*100/)).toBeVisible(); // 60 + 40, all-or-nothing
  await expect(page.getByText(/2 dari 2 materi selesai/)).toBeVisible();

  // --- Dashboard --------------------------------------------------------------
  await page.goto('/dashboard');
  await expect(page.getByText('Completed Events')).toBeVisible();
  // Achievement History mencatat event yang baru diselesaikan.
  await expect(page.getByText(EVENT_TITLE)).toBeVisible();
});
