# `server/db` — Data Layer

ORM: **Drizzle + `postgres.js`** (asumsi A-01 TDD). Migrasi lewat `drizzle-kit`.

## File

| File           | Keterangan                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `client.ts`    | Koneksi + pool. **Singleton lintas hot-reload** lewat `globalThis` agar `next dev` tidak membocorkan koneksi tiap reload |
| `schema/`      | 8 tabel + 7 enum + seluruh constraint & index (TDD §2.2–§2.10)                                                           |
| `migrations/`  | Output `drizzle-kit generate` — **tidak pernah diedit setelah merge**                                                    |
| `migrate.ts`   | Runner `npm run db:migrate`                                                                                              |
| `seed.ts`      | Seed dev: 1 admin + 3 peserta + 2 event published + 1 draft                                                              |
| `seed-bulk.ts` | Seed volume: 1 event × 20 materi × 150 peserta (TDD §11.4)                                                               |
| `reset.ts`     | `TRUNCATE ... RESTART IDENTITY` — struktur tidak disentuh                                                                |

## Perintah

```bash
npm run db:generate   # schema TypeScript → file SQL terversi
npm run db:migrate    # terapkan migrasi (langkah TERSENDIRI di pipeline deploy)
npm run db:seed       # data dasar development
npm run db:seed:bulk  # data volume untuk smoke test dashboard
npm run db:reset      # kosongkan seluruh tabel data
npm run db:studio     # Drizzle Studio (GUI)
```

## Aturan migrasi (TDD §2.11)

- Penamaan `NNNN_snake_case_deskripsi.sql`, nomor berurutan.
- Dijalankan sebagai **langkah tersendiri dalam pipeline deploy**, bukan di
  `postinstall` maupun saat boot aplikasi — migrasi saat boot membuat kegagalan skema
  muncul sebagai crash-loop, bukan deploy yang gagal dengan jelas.
- **Forward-only.** Migrasi destruktif wajib punya pasangan `NNNN_rollback.sql` yang
  di-review bersamaan. Kolom yang akan dihapus melewati siklus
  deprecate (nullable) → berhenti dibaca → drop di rilis berikutnya.

## Yang tidak boleh disederhanakan

Constraint unik, transaksi, dan idempotensi tetap di level database walau skalanya
kecil — satu double-click sudah cukup memicu insert ganda, dan validasi aplikasi saja
tidak bisa mencegahnya:

- `UNIQUE (event_id, user_id)` pada `enrollments` → 1 event 1× per peserta
- `UNIQUE (enrollment_id, material_id)` pada `material_progress` → poin sekali per materi
- `CHECK depth IN (0,1)` + trigger `materials_set_depth_trg` → maksimal 2 level materi
