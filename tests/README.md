# Tests

Uji beban skala besar (k6) **sengaja dihapus** dari rencana — pada 100–150 peserta,
angka SLO PRD §7.2 tercapai tanpa tuning khusus. Yang tetap wajib adalah uji yang
membuktikan **kebenaran di bawah konkurensi**, karena kelas bug ini tidak hilang walau
pesertanya sedikit (TDD §11.4).

## Tiga lapis, tiga tujuan

| Lapis                  | Runner             | Folder / file  | Membuktikan                                                       |
| ---------------------- | ------------------ | -------------- | ----------------------------------------------------------------- |
| Unit                   | Vitest (`unit`)    | `unit/`        | Logika murni: validasi, pagination cursor, sanitasi HTML          |
| Integration            | Vitest (`integration`) | `integration/` | Service layer + PostgreSQL: scoring, konkurensi, guard, integritas |
| HTTP envelope          | bash + curl        | `http/smoke.sh`| Kontrak status/kode error `/api/v1/*` pada server hidup           |
| E2E browser            | Playwright         | `e2e/`         | Alur user nyata di Chromium: auth, join→belajar→finish, builder, RBAC |

Konvensi pemisahan: file Vitest berekstensi `.test.ts` (hanya di `unit/` dan
`integration/`), spec Playwright berekstensi `.spec.ts` (hanya di `e2e/`).
Kedua runner tidak pernah saling memungut file.

## Prasyarat per lapis

| Lapis        | Prasyarat                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| Unit         | Tidak ada — jalan tanpa database                                           |
| Integration  | PostgreSQL hidup + `npm run db:migrate`                                    |
| smoke.sh     | Server hidup (`npm run dev` / `npm run start`) + akun seed                 |
| E2E          | PostgreSQL + migrate + `npm run db:seed` + `npx playwright install chromium` |

Playwright menyalakan servernya sendiri (`next build && next start`, lihat
`playwright.config.ts`); saat development, server `npm run dev` yang sudah hidup
di port 3000 akan dipakai ulang (`reuseExistingServer`).

## Perintah

```bash
npm run test               # seluruh Vitest (unit + integration)
npm run test:unit          # unit saja — tanpa PostgreSQL
npm run test:integration   # integration saja
npm run test:e2e           # Playwright (build + start server sendiri)
npm run test:e2e:ui        # Playwright UI mode untuk debugging
npm run test:all           # Vitest lalu Playwright
bash tests/http/smoke.sh   # HTTP envelope (server harus sudah hidup)
```

Reset penuh yang deterministik (opsional, destruktif terhadap data dev):

```bash
npm run db:reset && npm run db:migrate && npm run db:seed
```

## Kontrak penandaan data test

Semua baris yang dibuat test WAJIB memakai penanda ini supaya pembersihan presisi
dan tidak pernah menyentuh data seed (`tests/helpers/fixtures.ts`):

- email user diakhiri **`@test.local`**;
- judul event diawali **`[TEST]`**.

`cleanupTestData()` menghapus berdasarkan kedua penanda itu. Global setup E2E
(`e2e/global.setup.ts`) menjalankannya otomatis di awal tiap run.

## Rate limit

Dua batas yang menggigit suite otomatis (TDD §9.3): registrasi **3/jam/IP** dan
respons **10/menit** (env `RATE_LIMIT_RESPONSE_PER_MINUTE`). Rate limit dievaluasi
SEBELUM validasi, jadi percobaan gagal pun memakai kuota.

- Global setup E2E mengosongkan `rate_limits` otomatis di awal run.
- Manual: `npm run db:clear-rate-limits` (pengganti one-liner psql).
- Spec E2E hanya melakukan register lewat UI **sekali per run**; kebutuhan auth
  lain memakai akun seed (login API → `storageState`) atau user fixture DB.

## Uji konkurensi wajib (gate rilis, EPIC 8 Story 8.4)

| Uji                  | Bentuk                                                                      | Kriteria lulus                                                 |
| -------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Join paralel         | 50 request `enroll` bersamaan dari **satu** user ke satu event              | Tepat **1** enrollment; sisanya `409 ALREADY_ENROLLED`         |
| Kuota balapan        | 20 request `enroll` bersamaan pada event bersisa kuota 5                    | Tepat 5 berhasil, 15 `409 QUOTA_FULL`                          |
| Complete ganda       | 10 request `complete` bersamaan pada materi yang sama                       | Poin bertambah **sekali**, sisanya `reason: ALREADY_COMPLETED` |
| Smoke data realistis | `npm run db:seed:bulk` lalu buka dashboard admin, drill-down, matriks nilai | Semua halaman < 2 detik; tidak ada query > 200 ms              |

## Query assert integritas (TDD §11.4)

Keempat query berikut **harus mengembalikan 0 baris**; rilis diblokir bila tidak:

1. Tidak ada peserta yang join dua kali.
2. `enrollments.total_points` = jumlah `material_progress.points_earned`.
3. Tidak ada poin diberikan tanpa respons bertipe `answer`.
4. Tidak ada respons yang dibuat setelah enrollment `completed`.

## Catatan E2E

- Auth memakai **setup project** Playwright: login admin & peserta seed via API,
  cookie disimpan ke `tests/.auth/*.json` (gitignored) dan dipakai spec lewat
  `storageState`. Kalau setup gagal 401, jalankan `npm run db:seed`.
- `workers: 1` disengaja — satu database dibagi semua spec (alasan yang sama
  dengan `fileParallelism: false` di Vitest). Jalur paralelisasi kelak adalah
  namespacing data per-worker, bukan sekadar menaikkan angka worker.
- Drag-and-drop reorder (dnd-kit) tidak diuji lewat browser — rapuh; perilakunya
  tercakup `integration/material-guards.test.ts` dan `http/smoke.sh`.
