# Learning Study AI

Platform pembelajaran berbasis **event** (event-based LMS) untuk lingkungan
korporat/training. **Satu aplikasi Next.js** yang memuat frontend sekaligus backend —
UI lewat React Server/Client Component, API lewat Route Handler `/api/v1/*`, satu
codebase, satu deployment.

Dokumen acuan:

- PRD: `../doc/00-PRD.md`
- Technical Design Document: `../doc/01-ARCHITECTURE.md`
- Design system: `../doc/stitch_learning_study_ai_platform/adaptive_scholastic_narrative/DESIGN.md`

> **Status: EPIC 1 — Fondasi Proyek & Data Layer.**
> Belum ada fitur/UI. Yang sudah ada: scaffold project, design token, schema database
> lengkap beserta migrasi & seed, dan endpoint `/api/v1/health`.

## Stack

| Lapisan  | Pilihan                                                                  |
| -------- | ------------------------------------------------------------------------ |
| Aplikasi | Next.js 15 App Router + React 19 + TypeScript strict                     |
| Styling  | Tailwind CSS 3 dengan token dari `DESIGN.md` (setup produksi, bukan CDN) |
| ORM      | Drizzle ORM + `postgres.js`, migrasi via `drizzle-kit`                   |
| Database | PostgreSQL 16                                                            |
| Session  | Tabel `sessions` di PostgreSQL + cookie `HttpOnly` (tanpa Redis)         |
| Password | Argon2id (`@node-rs/argon2`)                                             |
| Media    | Adapter `blob` (Vercel Blob) / `local` (volume disk)                     |

## Menjalankan secara lokal

```bash
# 1. Dependency
npm install

# 2. Environment
cp .env.example .env      # lalu sesuaikan DATABASE_URL & SESSION_SECRET

# 3. Database — pilih salah satu:
#    a) PostgreSQL yang sudah terpasang di mesin
createdb learning_study_ai
#    b) Docker (hanya app + db, tanpa komponen lain)
docker compose -f docker/docker-compose.yml up -d db

# 4. Skema + data awal
npm run db:migrate
npm run db:seed

# 5. Jalankan
npm run dev               # http://localhost:3000
```

Cek kesehatan: `curl http://localhost:3000/api/v1/health` → `{"data":{"status":"ok",…}}`

### Akun hasil seed

| Peran   | Email                                                        | Password                        |
| ------- | ------------------------------------------------------------ | ------------------------------- |
| Admin   | `SEED_ADMIN_EMAIL` di `.env`                                 | `SEED_ADMIN_PASSWORD` di `.env` |
| Peserta | `andi@example.com`, `bunga@example.com`, `citra@example.com` | `Peserta12345`                  |

Password disimpan sebagai hash **Argon2id** — tidak pernah plaintext, termasuk di
seed script.

## Perintah

| Perintah                                  | Fungsi                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `npm run dev`                             | Development server                             |
| `npm run build` / `npm start`             | Build & jalankan production                    |
| `npm run lint` / `npm run lint:fix`       | ESLint                                         |
| `npm run typecheck`                       | `tsc --noEmit`                                 |
| `npm run format` / `npm run format:check` | Prettier                                       |
| `npm run db:generate`                     | Schema TypeScript → file SQL migrasi terversi  |
| `npm run db:migrate`                      | Terapkan migrasi                               |
| `npm run db:seed`                         | Data dasar development                         |
| `npm run db:seed:bulk`                    | Data volume: 1 event × 20 materi × 150 peserta |
| `npm run db:reset`                        | Kosongkan seluruh tabel data                   |
| `npm run db:studio`                       | Drizzle Studio                                 |

## Struktur folder

```
src/
├─ app/                     # Routing (App Router)
│  ├─ (public)/             # Login & Register — static, tanpa akses DB
│  ├─ (participant)/        # Dashboard, Catalog, Learning Player
│  ├─ (admin)/              # Dashboard monitoring, Event Builder, People
│  └─ api/v1/               # Route Handlers = backend
├─ server/                  # HANYA server-side (dilarang di-import client)
│  ├─ env.ts                # Validasi environment Zod, fail-fast
│  ├─ db/                   # client, schema, migrations, seed
│  ├─ auth/                 # password (Argon2id), session, rbac, guard
│  ├─ services/             # business logic — satu-satunya penulis ke DB
│  ├─ cache/                # unstable_cache tags + rate limit tabel Postgres
│  ├─ storage/              # adapter media blob | local
│  └─ http/                 # handler, errors, validate, pagination
├─ features/                # Komponen per domain (client)
├─ components/{ui,shared}/  # shadcn/ui + komponen lintas domain
├─ lib/                     # Utilitas aman untuk client + skema Zod bersama
└─ styles/globals.css       # Design token (CSS variables)
```

Setiap folder yang belum terisi punya `README.md` yang menjelaskan isinya dan epic
mana yang akan mengisinya.

## Aturan yang ditegakkan otomatis

| Aturan                                                                     | Ditegakkan oleh                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `features/` & `components/` dilarang import `server/**`                    | ESLint `no-restricted-imports`                             |
| Dilarang hex color literal di `.tsx`                                       | ESLint `no-restricted-syntax`                              |
| 1 event hanya 1× per peserta                                               | `UNIQUE (event_id, user_id)` di database                   |
| Poin sebuah materi hanya sekali per peserta                                | `UNIQUE (enrollment_id, material_id)`                      |
| Materi maksimal 2 level                                                    | `CHECK depth IN (0,1)` + trigger `materials_set_depth_trg` |
| Poin tidak negatif, jadwal `end_at > start_at`, konsistensi `issue_status` | `CHECK` constraint                                         |
| Environment tidak lengkap                                                  | Validasi Zod saat startup (gagal cepat)                    |

## Deployment

Dua target, **kode identik** — hanya `STORAGE_DRIVER` dan konfigurasi koneksi
database yang berbeda (TDD §11.1):

- **Vercel** (disarankan untuk MVP): Postgres managed dengan connection string
  ber-pooler, `DATABASE_POOL_MAX=5`, `STORAGE_DRIVER=blob`.
- **Satu container Docker**: `docker/docker-compose.yml` (hanya `app` + `db`),
  `STORAGE_DRIVER=local` dengan volume di-mount, `pg_dump` terjadwal **wajib**.

Urutan rilis: `build` → `npm run db:migrate` → deploy → cek `/api/v1/health`.

### Versioning & changelog

Setiap push ke `main` = deploy production, dan setiap deploy punya versi:

1. Naikkan `version` di `package.json` (SemVer).
2. Catat perubahannya sebagai entri baru di [CHANGELOG.md](CHANGELOG.md).
3. Push ke `main` — setelah CI hijau, job `release` otomatis membuat tag
   `v<versi>` + GitHub Release dengan catatan dari entri changelog tersebut.

Versi yang sedang ter-deploy bisa dicek lewat field `version` pada
`GET /api/v1/health`.
