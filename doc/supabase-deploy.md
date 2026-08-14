# Deploy Database ke Supabase

Checklist memindahkan database production dari PostgreSQL lokal ke Supabase,
untuk dipakai aplikasi yang sudah ter-deploy di Vercel.

## 1. Buat project Supabase

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pilih region terdekat dengan region function Vercel (default Vercel: `iad1`
   / Washington D.C. → pilih **East US**; kalau function Vercel dipindah ke
   Singapore, pilih **Southeast Asia**). Latensi app↔DB jauh lebih penting
   daripada latensi user↔DB.
3. Simpan **database password** yang dibuat saat setup — dibutuhkan untuk kedua
   connection string di bawah. Jangan commit ke repo.

## 2. Dua connection string yang dipakai

Dari dashboard project → tombol **Connect** (kanan atas):

| Kegunaan | Jenis | Port | Catatan |
| --- | --- | --- | --- |
| Aplikasi di Vercel | **Transaction pooler** (Supavisor) | `6543` | Wajib di serverless; klien app otomatis set `prepare: false` |
| Migrasi & seed (dari mesin lokal / CI) | **Direct connection** atau **Session pooler** | `5432` | DDL & advisory lock migrator butuh koneksi sesi penuh |

Format kurang lebih:

```
# Transaction pooler → untuk Vercel
postgres://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres

# Session pooler → untuk migrasi/seed
postgres://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Deteksi pooler di `src/server/db/client.ts` melihat `:6543` /
`pooler.supabase.` pada URL — pastikan URL aplikasi memakai port 6543.

## 3. Set timeout di sisi database (sekali saja)

Di transaction pooler, parameter startup per-sesi dari klien tidak dijamin
sampai ke server, jadi `statement_timeout` & `idle_in_transaction_session_timeout`
(nilai yang sama dengan `client.ts` untuk koneksi langsung) dipindah ke role.
Jalankan sekali di **SQL Editor** Supabase:

```sql
ALTER ROLE authenticator SET statement_timeout = '5s';
ALTER ROLE postgres SET statement_timeout = '5s';
ALTER ROLE postgres SET idle_in_transaction_session_timeout = '10s';
```

(Role yang dipakai connection string default adalah `postgres`; baris
`authenticator` hanya relevan bila memakai API Supabase, aman di-skip.)

## 4. Jalankan migrasi + seed dari lokal

Pakai connection string **port 5432** (session), BUKAN 6543:

```bash
DATABASE_URL='postgres://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres' npm run db:migrate
```

Lalu bootstrap admin pertama (memakai `SEED_ADMIN_*` — password di-hash
Argon2id oleh seed, tidak tersimpan plaintext):

```bash
DATABASE_URL='postgres://...:5432/postgres' \
SEED_ADMIN_EMAIL='admin@domain-kamu.com' \
SEED_ADMIN_PASSWORD='<password-kuat>' \
npm run db:seed
```

Verifikasi: di Supabase **Table Editor** harus terlihat tabel-tabel skema plus
`users` berisi satu baris admin.

## 5. Set env di Vercel

Project Settings → **Environment Variables** (scope **Production**; ulangi untuk
Preview bila ingin preview memakai DB yang sama — lebih aman pakai project
Supabase terpisah untuk Preview):

| Variable | Nilai |
| --- | --- |
| `DATABASE_URL` | Connection string **transaction pooler, port 6543** — tandai *Sensitive* |
| `DATABASE_POOL_MAX` | `5` |

Env lain (SESSION_SECRET, STORAGE_DRIVER=blob, dst.) mengikuti setup deploy
yang sudah ada; yang berubah karena Supabase hanya dua di atas.

Setelah env diubah, **redeploy** (env baru tidak berlaku untuk deployment lama).

## 6. Smoke test

1. Buka URL production → halaman login harus tampil tanpa error 500.
2. Login dengan admin hasil seed.
3. Cek log function di Vercel: tidak boleh ada error koneksi database
   (`CONNECT_TIMEOUT`, `prepared statement ... does not exist`, dsb.).

## Jebakan yang sudah diantisipasi

- **Prepared statements di pooler** — Supavisor transaction mode tidak
  mendukungnya; `client.ts` otomatis `prepare: false` saat URL mengandung
  `:6543` / `pooler.supabase.`.
- **Migrasi lewat 6543** — migrator Drizzle memakai advisory lock & DDL yang
  butuh koneksi sesi; selalu migrasi lewat port 5432.
- **`DATABASE_POOL_MAX` lupa diturunkan** — tiap instance serverless membuka
  pool sendiri; 10 × banyak instance akan menabrak batas koneksi Supabase.
- **IPv6 direct connection** — host `db.<ref>.supabase.co` (direct, non-pooler)
  hanya IPv6 di plan gratis; kalau jaringan lokal tidak punya IPv6, pakai
  **Session pooler** port 5432 untuk migrasi (contoh di atas sudah begitu).
