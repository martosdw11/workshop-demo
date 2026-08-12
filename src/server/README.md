# `src/server/**` — kode server saja

**Dilarang di-import dari `features/**` atau `components/**`.** Aturan ini ditegakkan
ESLint (`no-restricted-imports` di `eslint.config.mjs`), bukan sekadar konvensi —
inilah yang menjaga "FE dan BE jadi satu aplikasi" tidak berubah menjadi kode yang
saling menempel (TDD §1.1, §1.3).

Route Handler dan Server Component adalah dua pintu masuk berbeda, tetapi **keduanya
memanggil service layer yang sama**.

## Isi folder

| Folder      | Status      | Keterangan                                                                                     |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `env.ts`    | ✅ EPIC 1   | Validasi environment Zod, fail-fast (TDD §10)                                                  |
| `db/`       | ✅ EPIC 1   | Client, schema Drizzle, migrasi, seed                                                          |
| `auth/`     | 🚧 sebagian | `password.ts` sudah ada (dipakai seed). `session.ts`, `rbac.ts`, `guard.ts` menyusul di EPIC 2 |
| `services/` | ⬜ EPIC 2+  | Business logic — **satu-satunya penulis ke DB**                                                |
| `cache/`    | ⬜ EPIC 6   | `tags.ts` (`unstable_cache` + `revalidateTag`), `ratelimit.ts` (tabel Postgres)                |
| `storage/`  | ⬜ EPIC 3   | Adapter media: `index.ts`, `blob.ts`, `local.ts` (TDD §8.1)                                    |
| `http/`     | ⬜ EPIC 2   | `handler.ts`, `errors.ts`, `validate.ts`, `pagination.ts` (amplop error §9.1)                  |

## Urutan lock transaksi (WAJIB)

`events` → `enrollments` → `material_progress` → `users`.

Deviasi dari urutan ini adalah penyebab deadlock dan **wajib ditolak saat code review**
(TDD §4.3).
