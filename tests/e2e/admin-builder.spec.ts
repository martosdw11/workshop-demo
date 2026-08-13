import { expect, request as pwRequest, test } from '@playwright/test';

import { ADMIN_STATE, PARTICIPANT_STATE } from './helpers/auth';

/**
 * Alur admin membangun event lewat UI builder — buat draft → susun kurikulum
 * (autosave) → publish → tampil di katalog peserta.
 *
 * Drag-and-drop reorder SENGAJA tidak diuji di sini (dnd-kit rapuh untuk
 * diotomasi); perilaku reorder tercakup di tests/integration/material-guards
 * dan smoke.sh pada level API.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const STAMP = `${Date.now()}`;
const EVENT_TITLE = `[TEST] E2E Builder ${STAMP}`;

test.use({ storageState: ADMIN_STATE });

function datetimeLocal(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

test('buat event → susun kurikulum → publish → muncul di katalog', async ({ page }) => {
  // --- Step 1: info event -----------------------------------------------------
  await page.goto('/admin/events/new');
  await expect(page.getByRole('heading', { name: 'Buat Event Baru' })).toBeVisible();

  await page.getByLabel('Judul Event').fill(EVENT_TITLE);
  await page.getByLabel('Deskripsi').fill('Event uji builder E2E.');
  await page.locator('#startAt').fill(datetimeLocal(-1));
  await page.locator('#endAt').fill(datetimeLocal(30));
  await page.getByRole('button', { name: 'Simpan & lanjut ke kurikulum' }).click();

  await expect(page.getByText('Event dibuat sebagai draft')).toBeVisible();
  await page.waitForURL(/\/admin\/events\/\d+\/edit\?step=2/);

  // --- Step 2: kurikulum (autosave, tanpa tombol save) -------------------------
  await page.getByRole('button', { name: 'Add Module' }).click();
  const moduleTitle = page.getByLabel('Judul Modul 1');
  await expect(moduleTitle).toHaveValue('Modul baru');
  await moduleTitle.fill('Pengenalan');
  await page.getByLabel('Pts').first().fill('25');

  // Isi konten lewat editor TipTap (contenteditable).
  await page.getByRole('button', { name: 'Buka editor konten' }).first().click();
  await page.locator('[contenteditable="true"]').first().click();
  await page.keyboard.type('Materi pengantar untuk uji E2E.');

  await page.getByRole('button', { name: 'Add Lesson' }).click();
  const lessonTitle = page.getByLabel('Judul Lesson 1.1');
  await expect(lessonTitle).toHaveValue('Sub-materi baru');
  await lessonTitle.fill('Detail Pengenalan');

  // Tunggu autosave debounce 800 ms menuntaskan PATCH terakhir. Paragraf status
  // juga memuat teks ligatur ikon, jadi dicocokkan sebagai substring — huruf T
  // kapital membedakannya dari label idle "Perubahan tersimpan otomatis".
  const summary = page.getByRole('complementary', { name: 'Ringkasan kurikulum' });
  await expect(summary.locator('[aria-live="polite"]')).toContainText('Tersimpan', {
    timeout: 10_000,
  });
  await expect(summary).toContainText('Total Materi');

  // --- Publish ------------------------------------------------------------------
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByText('Event dipublikasikan dan muncul di katalog peserta.'),
  ).toBeVisible();

  // --- Terlihat oleh peserta di katalog (via API, tanpa pindah sesi browser) ----
  const participantApi = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: PARTICIPANT_STATE,
  });
  const catalog = await participantApi.get(
    `/api/v1/events?status=all&q=${encodeURIComponent(`E2E Builder ${STAMP}`)}&limit=12`,
  );
  expect(catalog.ok(), await catalog.text()).toBeTruthy();
  expect(await catalog.text()).toContain(EVENT_TITLE);
  await participantApi.dispose();
});
